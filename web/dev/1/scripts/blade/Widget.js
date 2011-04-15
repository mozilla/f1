/**
 * @license blade/Widget Copyright (c) 2010, The Dojo Foundation All Rights Reserved.
 * Available via the MIT, GPL or new BSD license.
 * see: http://github.com/jrburke/blade for details
 */
/*jslint  plusplus: false, nomen: false */
/*global define: false, document */

'use strict';

/**
 * Parts of this taken from Dojo, in particular DOM work related to
 * dojo._toDom()
 */

define([ 'require', './object', './fn', './jig', 'module'],
function (require,   object,     fn,     jig,     module) {

    var tempNode,
        baseAttrName = 'data-' + module.id.replace(/\//g, '-') + '-' +
                       (Math.random() + '').replace(/\d\./, ''),
        typeAttr = baseAttrName + '-wtype',
        idAttr = baseAttrName + '-wid',
        idCounter = 0,
        registry = {},

        Widget = object(null, null, {
            template: null,
            /**
             * Creates a new instance. Should be called by any derived objects.
             * data can have some special properties:
             * parent: the parent node to
             *
             */
            init: function (data, relNode, position) {
                object.mixin(this, data, true);

                var asyncCreate, onFinishCreate;

                //Start widget lifecycle
                if (this.onCreate) {
                    asyncCreate = this.onCreate();
                }

                onFinishCreate = fn.bind(this, function () {
                    if (this.template) {
                        this.node = this.render();
                        if (this.onRender) {
                            this.onRender(relNode);
                        }
                    }

                    if (relNode && this.node) {
                        if (position === 'before') {
                            relNode.parentNode.insertBefore(this.node, relNode);
                        } else if (position === 'after') {
                            relNode.parentNode.insertBefore(this.node, relNode.nextSibling);
                        } else if (position === 'prepend' && relNode.firstChild) {
                            relNode.insertBefore(this.node, relNode.firstChild);
                        } else {
                            relNode.appendChild(this.node);
                        }
                    }
                });

                if (asyncCreate) {
                    asyncCreate.then(onFinishCreate);
                    this.asyncCreate = asyncCreate;
                } else {
                    onFinishCreate();
                }
            },

            // poor man deferred thingy for now. May want to swap out
            // with a real promise implementation at some point.
            makeCreateCallback: function () {
                var p = {
                    _callbacks: [],
                    then: function (callback) {
                        if ('value' in p) {
                            callback(p.value);
                        } else {
                            p._callbacks.push(callback);
                        }
                    },
                    resolve: function (value) {
                        if ('value' in p) {
                            throw new Error ('Async widget already resolved');
                        } else {
                            // Setting the value
                            p.value = value;
                            p._callbacks.forEach(function (callback) {
                               callback(value);
                            });
                        }
                    }
                };

                return p;
            },

            render: function (relativeNode) {
                var doc, child, renderedNode, id;
                if (this.template) {
                    //Normalize template by trimming whitespace.
                    this.template = this.template.trim();

                    doc = relativeNode && relativeNode.ownerDocument || document;
                    id = 'id' + idCounter++;

                    //Set up a temp node to hold template
                    if (!tempNode || tempNode.ownerDocument !== doc) {
                        tempNode = doc.createElement('div');
                    }

                    tempNode.innerHTML = this.templatize();

                    // one node shortcut => return the node itself
                    if (tempNode.childNodes.length === 1) {
                        renderedNode = tempNode.removeChild(tempNode.firstChild);
                        renderedNode.setAttribute(idAttr, id);
                        renderedNode.setAttribute(typeAttr, this.moduleId);
                    } else {
                        // return multiple nodes as a document fragment
                        renderedNode = doc.createDocumentFragment();
                        while ((child = tempNode.firstChild)) {
                            renderedNode.appendChild(child);
                            if (child.nodeType === 1) {
                                child.setAttribute(idAttr, id);
                                child.setAttribute(typeAttr, this.moduleId);
                            }
                        }
                    }

                    this._widgetId = id;
                    registry[id] = this;
                }

                return renderedNode;
            },

            templatize: function () {
                var text = this.template,
                    cache = jig.cache(text) || jig.cache(text, text, this.jigOptions);

                return jig.render(cache, this, this.jigOptions);
            },

            /**
             * Destroys the widget. Derived objects should call this method
             * after they do their destroy work. destroy is a nice time to
             * clean up event handlers.
             */
            destroy: function () {
                if (this.node && this.node.parentNode) {
                    this.node.parentNode.removeChild(this.node);
                }
                delete this.node;
                delete registry[this._widgetId];
            }
        });

    Widget.closest = function (widgetType, evt, funcName) {
        var refNode = evt.target,
            widget;

        //Walk up the list of nodes until a match with the type is found.
        while (refNode) {
            if (refNode.getAttribute(typeAttr) === widgetType) {
                break;
            }
            refNode = refNode.parentNode;
        }

        if (refNode) {
            widget = registry[refNode.getAttribute(idAttr)];
            if (widget) {
                widget[funcName](evt);
            }
        }
    };

    Widget.registry = registry;

    return Widget;
});
