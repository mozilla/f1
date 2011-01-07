/**
 * @license blade/jig Copyright (c) 2010, The Dojo Foundation All Rights Reserved.
 * Available via the MIT, GPL or new BSD license.
 * see: http://github.com/jrburke/blade for details
 */
/*jslint  nomen: false, plusplus: false */
/*global define: false, document: false, console: false, jQuery: false */

'use strict';

define(['require', './object'], function (require,   object) {

    //Fix unit test: something is wrong with it, says it passes, but
    //with attachData change, the string is actually different now.
    //TODO: for attachData, only generate a new ID when the data value changes,
    //and similarly, only attach the data one time per data value.

    //If have <img class="contactPhoto" src="{foo}"> browser tries to fetch
    //{foo} if that is in markup. Doing a <{/}img, then FF browser treats that
    //as &lt;{/}img. Using <img{/} ends up with <img{ }="" in text.

    var jig, commands,
        ostring = Object.prototype.toString,
        decode = typeof decodeURIComponent === 'undefined' ? function () {} : decodeURIComponent,
        startToken = '{',
        endToken = '}',
        rawHtmlToken = '^',
        templateRefToken = '#',
        argSeparator = ' ',
        //First character in an action cannot be something that
        //could be the start of a regular JS property name,
        //or an array indice indicator, [, or the HTML raw output
        //indicator, ^.
        propertyRegExp = /[_\[\^\w]/,
        defaultArg = '_',
        startTagRegExp = /<\s*\w+/,
        wordRegExp = /^\d+$/,
        badCommentRegExp = /\/(\/)?\s*\]/,
        templateCache = {},
        defaultFuncs = {
            openCurly: function () {
                return '{';
            },
            closeCurly: function () {
                return '}';
            },
            eq: function (a, b) {
                return a === b;
            },
            gt: function (a, b) {
                return a > b;
            },
            gte: function (a, b) {
                return a >= b;
            },
            lt: function (a, b) {
                return a < b;
            },
            lte: function (a, b) {
                return a <= b;
            },
            or: function (a, b) {
                return !!(a || b);
            },
            and: function (a, b) {
                return !!(a && b);
            },
            is: function (a) {
                return !!a;
            },
            eachProp: function (obj) {
                //Converts object properties into an array
                //of objects that have 'prop' and 'value' properties.
                var prop, ret = [];
                for (prop in obj) {
                    if (obj.hasOwnProperty(prop)) {
                        ret.push({
                            prop: prop,
                            value: obj[prop]
                        });
                    }
                }

                //Sort the names to be roughly alphabetic
                return ret.sort(function (a, b) {
                    return a.prop > b.prop ? 1 : -1;
                });
            }
        },
        attachData = false,
        dataIdCounter = 1,
        controlIdCounter = 1,
        dataRegistry = {},
        tempNode = typeof document !== 'undefined' && document.createElement ?
                   document.createElement('div') : null,
        templateClassRegExp = /(\s*)(template)(\s*)/;

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Gets a property from a context object. Allows for an alternative topContext
     * object that can be used for the first part property lookup if it is not
     * found in context first.
     * @param {Array} parts the list of nested properties to look up on a context.
     * @param {Object} context the context to start the property lookup
     * @param {Object} [topContext] an object to use as an alternate context
     * for the very first part property to look up if it is not found in context.
     * @returns {Object}
     */
    function getProp(parts, context, topContext) {
        var obj = context, i, p;
        for (i = 0; obj && (p = parts[i]); i++) {
            obj = (typeof obj === 'object' && p in obj ? obj[p] : (topContext && i === 0 && p in topContext ? topContext[p] : undefined));
        }
        return obj; // mixed
    }

    function strToInt(value) {
        return value ? parseInt(value, 10) : 0;
    }

    function getObject(name, data, options) {
        var brackRegExp = /\[([\w0-9\.'":]+)\]/,
            part = name,
            parent = data,
            isTop = true,
            match, pre, prop, obj, startIndex, endIndex, indices, result,
            parenStart, parenEnd, func, funcName, arg, args, i, firstChar;

        //If asking for the default arg it means giving back the current data.
        if (name === defaultArg) {
            return data;
        }

        //If name is just an integer, just return it.
        if (wordRegExp.test(name)) {
            return strToInt(name);
        }

        //An empty string is just returned.
        if (name === '') {
            return '';
        }

        //If the name looks like a string, just return that.
        firstChar = name.charAt(0);
        if (firstChar === "'" || firstChar === "'") {
            return name.substring(1, name.length - 1);
        }

        //First check for function call. Function must be globally visible.
        if ((parenStart = name.indexOf('(')) !== -1) {
            parenEnd = name.lastIndexOf(')');
            funcName = name.substring(0, parenStart);
            func = options.fn[funcName];
            if (!func) {
                jig.error('Cannot find function named: ' + funcName + ' for ' + name);
                return '';
            }
            arg = name.substring(parenStart + 1, parenEnd);
            if (arg.indexOf(',') !== -1) {
                args = arg.split(',');
                for (i = args.length - 1; i >= 0; i--) {
                    args[i] = getObject(args[i], data, options);
                }
                result = func.apply(null, args);
            } else {
                result = func(getObject(arg, data, options));
            }
            if (parenEnd < name.length - 1) {
                //More data properties after the function call, fetch them
                //If the part after the paren is a dot, then skip over that part
                if (name.charAt(parenEnd + 1) === '.') {
                    parenEnd += 1;
                }
                return getObject(name.substring(parenEnd + 1, name.length), result, options);
            } else {
                return result;
            }
        }

        //Now handle regular object references, which could have [] notation.
        while ((match = brackRegExp.exec(part))) {
            prop = match[1].replace(/['"]/g, '');
            pre = part.substring(0, match.index);

            part = part.substring(match.index + match[0].length, part.length);
            if (part.indexOf('.') === 0) {
                part = part.substring(1, part.length);
            }

            obj = getProp(pre.split('.'), parent, isTop ? options.context : null);
            isTop = false;

            if (!obj && prop) {
                jig.error('blade/jig: No property "' + prop + '" on ' + obj);
                return '';
            }

            if (prop.indexOf(':') !== -1) {
                //An array slice action
                indices = prop.split(':');
                startIndex = strToInt(indices[0]);
                endIndex = strToInt(indices[1]);

                if (!endIndex) {
                    obj = obj.slice(startIndex);
                } else {
                    obj = obj.slice(startIndex, endIndex);
                }
            } else {
                if (options.strict && !(prop in obj)) {
                    jig.error('blade/jig: no property "' + prop + '"');
                }
                obj = obj[prop];
            }
            parent = obj;
        }

        if (!part) {
            result = parent;
        } else {
            result = getProp(part.split('.'), parent, isTop ? options.context : null);
        }

        if (options.strict && result === undefined) {
            jig.error('blade/jig: undefined value for property "' + name + '"');
        }

        return result;
    }

    /**
     * Gets a compiled template based on the template ID. Will look in the
     * DOM for an element with that ID if a template is not found already in
     * the compiled cache.
     * @param {String} id the ID of the template/DOM node
     * @param {Object} [options]
     *
     * @returns {Array} the compiled template.
     */
    function compiledById(id, options) {
        options = options || {};
        var compiled = jig.cache(id, options), node;

        //Did not find the text template. Maybe it is a DOM element.
        if (compiled === undefined && typeof document !== 'undefined') {
            node = document.getElementById(id);
            if (node) {
                jig.parse([node], options);
            }
            compiled = jig.cache(id, options);
        }
        if (compiled === undefined) {
            throw new Error('blade/jig: no template or node with ID: ' + id);
        }
        return compiled;
    }

    commands = {
        '_default_': {
            doc: 'Property reference',
            action: function (args, data, options, children, render) {
                var value = args[0] ? getObject(args[0], data, options) : data,
                    comparison = args[1] ? getObject(args[1], data, options) : undefined,
                    i, text = '';

                //If comparing to some other value, then the value is the data,
                //and need to compute if the values compare.
                if (args[1]) {
                    comparison = value === comparison;
                    value = data;
                } else {
                    //Just use the value, so the value is used in the comparison.
                    comparison = value;
                }
                //Want to allow returning 0 for values, so this next check is
                //a bit verbose.
                if (comparison === false || comparison === null ||
                    comparison === undefined || (isArray(comparison) && !comparison.length)) {
                    return '';
                } else if (children) {
                    if (isArray(value)) {
                        for (i = 0; i < value.length; i++) {
                            text += render(children, value[i], options);
                        }
                    } else {
                        //If the value is true or false, then just use parent data.
                        //for the child rendering.
                        if (typeof value === 'boolean') {
                            value = data;
                        }
                        text = render(children, value, options);
                    }
                } else {
                    text = value;
                }
                return text;
            }
        },
        '!': {
            doc: 'Not',
            action: function (args, data, options, children, render) {
                var value = getObject(args[0], data, options),
                    comparison = args[1] ? getObject(args[1], data, options) : undefined;

                //If comparing to some other value, then the value is the data,
                //and need to compute if the values compare.
                if (args[1]) {
                    comparison = value === comparison;
                    value = data;
                } else {
                    //Just use the value, so the value is used in the comparison.
                    comparison = value;
                }

                if (children && !comparison) {
                    return render(children, data, options);
                }
                return '';
            }
        },
        '#': {
            doc: 'Template reference',
            action: function (args, data, options, children, render) {
                var compiled = compiledById(args[0], options);
                data = getObject(args.length > 1 ? args[1] : defaultArg, data, options);
                return render(compiled, data, options);
            }
        },
        '.': {
            doc: 'Variable declaration',
            action: function (args, data, options, children, render) {
                options.context[args[0]] = getObject(args[1], data, options);
                //TODO: allow definining a variable then doing a block with
                //that variable.
                return '';
            }
        },
        '>': {
            doc: 'Else',
            action: function (args, data, options, children, render) {
                if (children) {
                    return render(children, data, options);
                }
                return '';
            }
        }
    };

    jig = function (text, data, options) {
        var id;
        if (typeof text === 'string') {
            if (text.charAt(0) === '#') {
                //a lookup by template ID
                id = text.substring(1, text.length);
                text = compiledById(id, options);
            } else {
                text = jig.compile(text, options);
            }
        }
        return jig.render(text, data, options);
    };

    jig.htmlEscape = function (text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    function compile(text, options) {
        var compiled = [],
            start = 0,
            useRawHtml = false,
            controlId = 0,
            segment, index, match, tag, command, args, lastArg, lastChar,
            children, i, tempTag;

        while ((index = text.indexOf(options.startToken, start)) !== -1) {
            //Output any string that is before the template tag start
            if (index !== start) {
                compiled.push(text.substring(start, index));
            }

            //Find the end of the token
            segment = text.substring(index);
            match = options.endRegExp.exec(segment);
            if (!match) {
                //Just a loose start thing could be a regular punctuation.
                compiled.push(segment);
                return compiled;
            } else {
                //Command Match!

                //Increment start past the match.
                start = index + match[0].length;

                //Pull out the command
                tag = text.substring(index + options.startToken.length, index + match[0].length - options.endToken.length).trim();

                //decode in case the value was in an URL field, like an  href or an img src attribute
                tag = decode(tag);

                //if the command is commented out end block call, that messes with stuff,
                //just throw to let the user know, otherwise browser can lock up.
                if (badCommentRegExp.test(tag)) {
                    throw new Error('blade/jig: end block tags should not be commented: ' + tag);
                }

                command = tag.charAt(0);

                if (command === ']' && controlId) {
                    //In a control block, previous block was a related control block,
                    //so parse it without the starting ] character.
                    tempTag = tag.substring(1).trim();
                    if (tempTag === '[') {
                        command = '>';
                    } else {
                        command = tempTag.charAt(0);
                        //Remove the starting ] so it is seen as a regular tag
                        tag = tempTag;
                    }
                }

                if (command && !options.propertyRegExp.test(command)) {
                    //Have a template command
                    tag = tag.substring(1).trim();
                } else {
                    command = '_default_';
                    //Command could contain just the raw HTML indicator.
                    useRawHtml = (command === options.rawHtmlToken);
                }

                //Allow for raw HTML output, but it is not the default.
                //template references use raw by default though.
                if ((useRawHtml = tag.indexOf(options.rawHtmlToken) === 0)) {
                    tag = tag.substring(options.rawHtmlToken.length, tag.length);
                }
                //However, template references use raw always
                if (command === templateRefToken) {
                    useRawHtml = true;
                }

                args = tag.split(options.argSeparator);
                lastArg = args[args.length - 1];
                lastChar = lastArg.charAt(lastArg.length - 1);
                children = null;

                if (command === ']') {
                    //If there are no other args, this is an end tag, to close
                    //out a block and possibly a set of control blocks.
                    if (lastChar !== '[') {
                        //End of a block. End the recursion, let the parent know
                        //the place where parsing stopped.
                        compiled.templateEnd = start;

                        //Also end of a control section, indicate it as such.
                        compiled.endControl = true;
                    } else {
                        //End of a block. End the recursion, let the parent know
                        //the place where parsing stopped, before this end tag,
                        //so it can process it and match it to a control flow
                        //from previous control tag.
                        compiled.templateEnd = start - match[0].length;
                    }

                    return compiled;
                } else if (lastChar === '[') {
                    //If last arg ends with a [ it means a block element.

                    //Assign a new control section ID if one is not in play already
                    if (!controlId) {
                        controlId = controlIdCounter++;
                    }

                    //Adjust the last arg to not have the block character.
                    args[args.length - 1] = lastArg.substring(0, lastArg.length - 1);

                    //Process the block
                    children = compile(text.substring(start), options);

                    //Skip the part of the string that is part of the child compile.
                    start += children.templateEnd;
                }

                //If this defines a template, save it off,
                //if a comment (starts with /), then ignore it.
                if (command === '+') {
                    options.templates[args[0]] = children;
                } else if (command !== '/') {
                    //Adjust args if some end in commas, it means they are function
                    //args.
                    if (args.length > 1) {
                        for (i = args.length - 1; i >= 0; i--) {
                            if (args[i].charAt(args[i].length - 1) === ',') {
                                args[i] = args[i] + args[i + 1];
                                args.splice(i + 1, 1);
                            }
                        }
                    }

                    compiled.push({
                        action: options.commands[command].action,
                        useRawHtml: useRawHtml,
                        args: args,
                        controlId: controlId,
                        children: children
                    });
                }

                //If the end of a block, clear the control ID
                if (children && children.endControl) {
                    controlId = 0;
                }
            }
        }

        if (start !== text.length - 1) {
            compiled.push(text.substring(start, text.length));
        }

        return compiled;
    }

    jig.compile = function (text, options) {
        //Mix in defaults
        options = options || {};
        object.mixin(options, {
            startToken: startToken,
            endToken: endToken,
            rawHtmlToken: rawHtmlToken,
            propertyRegExp: propertyRegExp,
            commands: commands,
            argSeparator: argSeparator,
            templates: templateCache
        });

        options.endRegExp = new RegExp('[^\\r\\n]*?' + endToken);

        //Do some reset to avoid a number from getting too big.
        controlIdCounter = 1;

        return compile(text, options);
    };

    /**
     * Converts a node to a compiled template, and will store it in the cache. If already
     * in the cache, it will give back the cached value.
     */
    function nodeToCompiled(node, options) {
        var text, compiled, clss,
            id = node.id,
            cache = options.templates || templateCache;

        //If the nodes has already been cached, then just get the cached value.
        if (cache[id]) {
            return cache[id];
        }

        //Call listener to allow processing of the node before
        //template complication happens.
        if (options.onBeforeParse) {
            options.onBeforeParse(node);
        }

        if (node.nodeName.toUpperCase() === 'SCRIPT') {
            text = node.text.trim();
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        } else {
            //Put node in temp node to get the innerHTML so node's element
            //html is in the output.
            tempNode.appendChild(node);

            //Remove the id node and the template class, since this
            //template text could be duplicated many times, and a
            //template class is no longer useful.
            node.removeAttribute('id');
            clss = (node.getAttribute('class') || '').trim();
            if (clss) {
                node.setAttribute('class', clss.replace(templateClassRegExp, '$1$3'));
            }

            //Decode braces when may get URL encoded as part of hyperlinks
            text = tempNode.innerHTML.replace(/%7B/g, '{').replace(/%7D/g, '}');

            //Clear out the temp node for the next use.
            tempNode.removeChild(node);
        }
        compiled = jig.compile(text, options);
        jig.cache(id, compiled, options);
        return compiled;
    }

    /**
     * Parses an HTML document for templates, compiles them, and stores them
     * in a cache of templates to use on the page. Only useful in browser environments.
     * Script tags with type="text/template" are parsed, as well as DOM elements
     * that have a class of "template" on them. The found nodes will be removed
     * from the DOM as part of the parse operation.
     *
     * @param {Array-Like} [nodes] An array-like list of nodes. Could be a NodeList.
     * @param {Object} [options] A collection of options to use for compilation.
     */
    jig.parse = function (nodes, options) {
        //Allow nodes to not be passed in, but still have options.
        if (nodes && !nodes.length) {
            options = nodes;
            nodes = null;
        }

        options = options || {};
        nodes = nodes || document.querySelectorAll('.template, script[type="text/template"]');

        var node, i;

        for (i = nodes.length - 1; i > -1 && (node = nodes[i]); i--) {
            nodeToCompiled(node, options);
        }
    };

    function render(compiled, data, options) {
        var text = '', i, dataId, controlId, currentControlId, currentValue, lastValue;
        if (typeof compiled === 'string') {
            text = compiled;
        } else if (isArray(compiled)) {
            for (i = 0; i < compiled.length; i++) {
                //Account for control blocks (if/elseif/else)
                //control blocks all have the same control ID, so only call the next
                //control block if the first one did not return a value.
                currentControlId = compiled[i].controlId;
                if (!currentControlId || currentControlId !== controlId || !lastValue) {
                    currentValue = render(compiled[i], data, options);
                    text += currentValue;
                    if (currentControlId) {
                        controlId = currentControlId;
                        lastValue = currentValue;
                    }
                }
            }
        } else {
            //A template command to run.
            text = compiled.action(compiled.args, data, options, compiled.children, render);
            if (!text) {
                text = '';
            } else if (!compiled.useRawHtml && !compiled.children) {
                //Only html escape commands that are not block actions.
                text = jig.htmlEscape(text.toString());
            }
        }

        if (options.attachData) {
            if (startTagRegExp.test(text)) {
                dataId = 'id' + (dataIdCounter++);
                text = text.replace(startTagRegExp, '$& data-blade-jig="' + dataId + '" ');
                dataRegistry[dataId] = data;
            }
        }

        return text;
    }

    /**
     * Render a compiled template.
     *
     * @param {Array} compiled a compiled template
     * @param {Object} data the data to use in the template
     * @param {Object} options options for rendering. They include:
     * @param {Object} templates a cache of compiled templates that might be
     * referenced by the primary template
     * @param {Object} options.fn a set of functions that might be used
     * by the template(s). Each property on this object is a name of a function
     * that may show up in the templates, and the value should be the function
     * definition.
     * @returns {String} the rendered template.
     */
    jig.render = function (compiled, data, options) {
        var i, result = '';

        //Normalize options, filling in defaults.
        options = options || {};
        object.mixin(options, {
            templates: templateCache,
            attachData: attachData,
            strict: jig.strict
        });

        //Mix in default functions
        if (options.fn) {
            object.mixin(options.fn, defaultFuncs);
        } else {
            options.fn = defaultFuncs;
        }

        //Mix in top level context object
        options.context = options.context || object.create(data);

        //If data is an array, then render should be called for each item
        //in the array.
        if (isArray(data)) {
            for (i = 0; i < data.length; i++) {
                result += render(compiled, data[i], options);
            }
            return result;
        }

        //Default case, just render
        return render(compiled, data, options);
    };

    /**
     * Enable strict template rendering checks. If a property does not exist on a
     * data object, then an error will be logged.
     */
    jig.strict = false;

    /**
     * Track errors by logging to console if available.
     */
    jig.error = function (msg) {
        throw msg;
    };

    /**
     * Adds functions to the default set of functions that can be used inside
     * a template. Newer definitions of a function will take precedence
     * over the previously registered function.
     * @param {Object} an object whose properties are names of functions
     * and values are the functions that correspond to the names.
     */
    jig.addFn = function (obj) {
        object.mixin(defaultFuncs, obj, true);
    };

    /**
     * Gets and sets the data bound to a particular rendered template. Setting
     * the data does not change the already rendered template.
     *
     * @param {String||DOMNode} dataId the data ID, or a DOM node with a
     * data-blade-jig attribute that was generated from a rendered template.
     * @returns {Object} the bound data. Can return undefined if there is
     * no data stored with that ID.
     */
    jig.data = function (dataId, value) {
        if (typeof dataId !== 'string') {
            //Should be a DOM node or node list if it is not already a string.
            if (!dataId.nodeType) {
                dataId = dataId[0];
            }
            dataId = dataId.getAttribute('data-blade-jig');
        }

        if (value !== undefined) {
            return (dataRegistry[dataId] = value);
        } else {
            return dataRegistry[dataId];
        }
    };

    /**
     * Removes some data that was bound to a rendered template.
     * @param {String} dataId the data ID. It can be fetched from the
     * data-blade-jig attribute on a rendered template.
     */
    jig.removeData = function (dataId) {
        delete dataRegistry[dataId];
    };

    /**
     * Gets an object given a string representation. For example,
     * jig.getObject('foo.bar', baz) will return the baz.foo.bar value.
     *
     * @param {String} name the string value to fetch. The following formats
     * are allowed: 'foo.bar', 'foo['bar']', 'foo[0]', 'foo[2:6]'. The last one
     * will return an array subset. Functions are also supported: 'doSomething(foo.bar)'
     * but the doSomething function needs to be defined in the options.fn
     * property, as options.fn.doSomething = function (){}
     *
     * @param {Object} data the object to use as the basis for the object lookup.
     *
     * @param {Object} options. Options to the lookup. The only supported option
     * at this time is options.func, and object defining functions can could be
     * called.
     *
     * @returns {Object} it could return null if the name is not found off the data
     */
    jig.getObject = getObject;

    /**
     * Gets or sets a compiled template from a template cache.
     * @param {String} id the template ID
     * @param {String} [value] A string to compile to a template, or
     * the compiled template value.
     * @param {Object} [options] optional options object with a 'templates'
     * property that contains some cached templates. If provided, a matching
     * cache value for the ID will be used from options.templates, otherwise,
     * the ID will be used to look up in the global blade/jig template cache.
     * @returns {Object} a compiled template. It could return undefined if
     * not match is found.
     */
    jig.cache = function (id, value, options) {
        //Convert the value to a compiled templated if necessary.
        if (typeof value === 'string') {
            value = jig.compile(value, options);
        }

        //If value is not an array, then a get operation, likely an options.
        if (!isArray(value)) {
            options = value;
            value = undefined;
        }

        var cache = (options && options.templates) || templateCache;
        if (value !== undefined) {
            cache[id] = value;
        }

        //Return the value. For get use, the template may not be in
        //the local options.templates, but in the global cache, so
        //be sure to check both.
        return cache[id] || templateCache[id];
    };

    function addToJQuery(jQuery) {
        //Only handles queries where it is by a node ID, '#something'.
        jQuery.fn.jig = function (data, options) {
            //Convert this, which is a DOM node into a string of data
            options = options || {};

            var id = this.selector,
                compiled;

            if (id.charAt(0) !== '#') {
                throw new Error('blade/jig: only ID selectors, like "#something" are allowed with jig()');
            }
            id = id.substring(1, id.length);

            //See if the template is already compiled.
            compiled = (options.templates || templateCache)[id];

            if (!compiled) {
                compiled = nodeToCompiled(this[0]);
            }

            return jQuery(jig.render(compiled, data, options));
        };
    }

    //Set up the plugin with a RequireJS-aware jQuery module but also
    //if there is a global jQuery.
    //require.modify('jquery', 'jquery-jig', ['jquery'], addToJQuery);
    if (typeof jQuery !== 'undefined') {
        addToJQuery(jQuery);
    }

    return jig;
});
