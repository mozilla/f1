'use strict';
/*jslint plusplus: false, regexp: false */
/*global require: false, location: true, setTimeout: false, alert: false
  window: false, document: false */

require.def('index',
        ['jquery', 'rdapi', 'blade/object', 'blade/jig'],
function ($,        rdapi,   object,         jig) {

    var docs, urlSection, toc = [],
        urlParamRegExp = /\{([^\}]+)\}/g,
        fragLinkRegExp = /#StandardResponse|#Attachment|#Message|#Conversation/g,
        apiLinks = {
            '#StandardResponse': 'Standard Response',
            '#Attachment': 'Attachment',
            '#Message': 'Message',
            '#Conversation': 'Conversation'
        };

    //Add a pretty JSON method for use in templates
    jig.addFn({
        prettyJson: function (text) {
            return JSON.stringify(JSON.parse(text), null, "    ");
        },
        addApiHyperlinks: function (text) {
            var output = '', startIndex = 0, match;
            fragLinkRegExp.lastIndex = 0;
            while ((match = fragLinkRegExp.exec(text))) {
                match = match[0];
                output += jig.htmlEscape(text.substring(startIndex, fragLinkRegExp.lastIndex - match.length));
                output += '<a href="' + match + '">' + apiLinks[match] + '</a>';
                startIndex = fragLinkRegExp.lastIndex;
            }
            if (startIndex < text.length - 1) {
                output += jig.htmlEscape(text.substring(startIndex, text.length));
            }
            return output;
        },
        getType: function (it) {
            if (require.isArray(it)) {
                return 'array';
            } else if (typeof it === "object" && it !== undefined && it !== null) {
                return 'object';
            } else {
                return 'other';
            }
        },
        formatSimpleType: function (it) {
            if (it === null) {
                return 'null';
            } else if (it === 0) {
                return '0';
            } else if (it === undefined) {
                return 'undefined';
            } else if (it === true) {
                return 'true';
            } else if (it === false) {
                return 'false';
            } else {
                return it;
            }
        }
    });

    //Array sorting method for method entries. Separated as a distinct
    //function to make JSLint happy.
    function methodSort(a, b) {
        return a.name > b.name ? 1 : -1;
    }

    function hashUpdated() {
        //Hmm, an overflow div does not jump if the hash is changed, as in
        //a back/forward button press, so force it.
        var hash = location.href.split('#')[1] || '',
            listingNode = $('#listing')[0],
            targetNode;

        if (hash) {
            targetNode = $('[name="' + hash + '"]')[0];
            if (!targetNode) {
                if (hash.indexOf('%') !== -1) {
                    //Try unescaping the URL.
                    hash = decodeURIComponent(hash);
                    targetNode = $('[name="' + hash + '"]')[0];
                } else {
                    //Try escaping it
                    hash = encodeURIComponent(hash);
                    targetNode = $('[name="' + hash + '"]')[0];
                }
            }
        }

        setTimeout(function () {
            if (targetNode) {
                listingNode.scrollTop = listingNode.scrollTop + targetNode.getBoundingClientRect().top;
            } else {
                listingNode.scrollTop = 0;
            }
        }, 15);
    }

    function updateApiUrl(form, url) {
        var apiUrl = form.find('.apiUrl'),
            parameterUrl = form.find('.parameterUrl'),
            match, urlParam, urlParams = '', urlParamObj;

        //Show the API URL
        apiUrl.html(url).removeClass('hidden');
        parameterUrl.addClass('hidden');

        //If the URL has arguments in its path, show options for it.
        if (url.indexOf('{') !== -1) {
            //Put in the parameterized URL and attach the source
            //URL as a property on the DOM node for better perf
            parameterUrl
                .removeClass('hidden')
                .find('.editApiUrl')
                    .remove()
                    .end()
                .prepend('<input type="text" class="editApiUrl" value="' + url + '">')[0]
                .apiUrl = url;

            //Hide the normal h2 title
            apiUrl.addClass('hidden');

            //Parse out the fields in play
            urlParamRegExp.lastIndex = 0;
            while ((match = urlParamRegExp.exec(url))) {
                urlParam = match[1];
                urlParamObj = form[0].raindropApiMethod.urlargs && form[0].raindropApiMethod.urlargs[urlParam];

                urlParams += '<tr><td class="urlParamName">' + urlParam + '</td><td class="urlParamValue">';

                if (urlParamObj && urlParamObj.allowed) {
                    urlParams += '<select class="urlParamSelect" name="' + urlParam + '">' +
                                 '<option value=""></option>';
                    urlParamObj.allowed.forEach(function (value) {
                        urlParams += '<option value="' + value + '">' + value + '</option>';
                    });
                    urlParams += '</select>';
                } else {
                    urlParams += '<input type="text" class="urlParam" name="' + urlParam + '">';
                }

                urlParams += '</td></tr>';
            }
            form.find('.urlParams').html(urlParams);
        }
    }

    //delegated event handler that handles changes to URL arg fields, both input text ones,
    //and select elements.
    function changeApiUrl(evt) {
        //Handle key ups for modifying URL parameters
        //Only do an update on a timed delay, so that
        //the DOM is not beaten up for each key stroke.
        if (!urlSection) {
            urlSection = $(evt.target).parents('.parameterUrl');
            setTimeout(function () {
                var apiUrl = urlSection[0].apiUrl;

                urlSection.find('.urlParam, .urlParamSelect').each(function (i, node) {
                    var value = node.value.trim();
                    if (value) {
                        apiUrl = apiUrl.replace('{' + node.name + '}', value);
                    }
                });

                //Update the final URL
                urlSection.find('.editApiUrl').val(apiUrl);

                urlSection = null;
            }, 200);
        }
    }

    rdapi('docs', {
        success: function (json) {
            var prop, methodName, apiSection, methods, method, tocItem, obj,
                i, route, parts, urlParam;

            docs = json;

            //TOC is by API section and method name, build it up,
            //as well as the content that goes for each section.
            for (prop in docs) {
                if (docs.hasOwnProperty(prop)) {
                    apiSection = docs[prop];
                    methods = apiSection.methods;

                    //Create the TOC item for this API section.
                    tocItem = {
                        section: prop,
                        doc: apiSection.doc.replace(/<h1[^<]*<\/h1>/g, ''),
                        value: apiSection,
                        methods: []
                    };

                    //Create a method section in the TOC as well as the content
                    //that shows up in the main document section.
                    for (methodName in methods) {
                        if (methods.hasOwnProperty(methodName)) {
                            method = methods[methodName];

                            //Create quick lookups for urlargs parameters
                            if (method.urlargs) {
                                method.urlargs.forEach(function (arg) {
                                    method.urlargs[arg.name] = arg;
                                });
                            }

                            //Make sure the API routes are prefixed with /api
                            if (method.routes) {
                                for (i = 0; (route = method.routes[i]); i++) {
                                    //For any URL methods, if only one valid value,
                                    //then just fix it to that value. Thinking mostly
                                    //of contacts API where @{user} is normally just @me
                                    parts = route.split('/');
                                    parts.forEach(function (part, j) {
                                        urlParamRegExp.lastIndex = 0;
                                        parts[j] = part.replace(urlParamRegExp, function (match, p1) {
                                            if (method.urlargs) {
                                                urlParam = method.urlargs[p1];
                                                if (urlParam && urlParam.allowed && urlParam.allowed.length === 1) {
                                                    return urlParam.allowed[0];
                                                }
                                            }
                                            return match;
                                        });
                                    });
                                    route = parts.join('/');

                                    if (route.indexOf('/api') !== 0) {
                                        method.routes[i] = '/api' + route;
                                    }
                                }
                            }

                            obj = object.create(method, [{
                                name: methodName,
                                link: encodeURIComponent(prop) + ":" + encodeURIComponent(methodName)
                            }]);

                            //Generate the HTML content for this section.
                            obj.content = jig(jig.cache('methodContent'), obj, {}).replace(/<h1[^<]*<\/h1>/g, '');

                            tocItem.methods.push(obj);
                            //Store a shortcut to reference the method by name.
                            tocItem.methods[methodName] = obj;
                        }
                    }

                    //Sort the methods
                    tocItem.methods.sort(methodSort);

                    //Store a shortcut to reference the section by name.
                    toc[prop] = tocItem;
                    toc.push(tocItem);
                }
            }

            //Sort the toc contents
            toc.sort(function (a, b) {
                return a.section > b.section ? 1 : -1;
            });

            //Wait for page load to fill in the page content
            $(function () {
                var tocHtml = '',
                    html = '',
                    apiCallNode = $('.apiCall')[0],
                    play = $('#play');

                //Remove the apiCall node from the DOM, since just used for clone operations.
                apiCallNode.parentNode.removeChild(apiCallNode);

                toc.forEach(function (tocItem) {
                    //Create TOC entry
                    tocHtml += jig(jig.cache('sectionToc'), tocItem, {});

                    //Create content entry
                    html += jig(jig.cache('sectionContent'), tocItem, {}); 
                });

                $("#toc").append(tocHtml);
                $("#content").append(html);

                //Add the name attributes to static sections here instead of the HTML
                //to avoid a weird box sizing issue in Firefox.
                ['Notes', 'Conversation', 'Message', 'Attachment'].forEach(function (name) {
                    document.getElementById(name + 'Title').setAttribute('name', name);
                });

                //If have a location hash, then navigate to it now, since the links for
                //all TOC values have been inserted.
                hashUpdated();
                window.addEventListener('hashchange', hashUpdated, false);

                $('body')
                    //Handle the Try links
                    .delegate('.try', 'click', function (evt) {
                        evt.preventDefault();

                        //Get the API container
                        var form = $(apiCallNode.cloneNode(true)).appendTo('#play'),
                            params = '',
                            linkParts = evt.target.href.split("#")[1].split(':'),
                            method = toc[linkParts[1]].methods[decodeURIComponent(linkParts[2])],
                            routes = method.routes,
                            apiUrl = routes && routes[0] || '',
                            routeChoices = '';

                        //Put the API data structure on the form, for ease of referencing later.
                        form[0].raindropApiMethod = method;

                        //If more than one route, give a choice
                        if (routes && routes.length > 1) {
                            routes.forEach(function (route) {
                                routeChoices += '<option value="' + route + '" class="apiUrlChoice">' + route + '</option>';
                            });

                            form.find('.apiUrlExpand')
                                .removeClass('hidden')
                                .append(routeChoices);
                        }

                        updateApiUrl(form, apiUrl);

                        //Request options
                        if (!method.queryargs || !method.queryargs.length) {
                            form.find('.request').addClass('hidden');
                        } else {
                            method.queryargs.forEach(function (arg) {
                                params += '<tr><td class="paramName">' + arg.name + '</td><td class="paramValue">';
    
                                if (arg.allowed) {
                                    params += '<select name="' + arg.name + '">' +
                                              '<option value=""></option>';

                                    arg.allowed.forEach(function (value) {
                                        params += '<option value="' + value + '">' + value + '</option>';
                                    });
                                    params += '</select>';
                                } else {
                                    params += '<input type="text" name="' + arg.name + '">';
                                }

                                params += '</td></tr>';
                            });
                            form.find('.requestParams').html(params);
                        }

                        //Request Body
                        if (!method.body) {
                            form.find('.body').addClass('hidden');
                        } else {
                            if (method.examplebody) {
                                form.find('.requestBody').val(method.examplebody);
                            }
                        }
                        //Make sure the new form is visible.
                        play[0].scrollTop = play[0].scrollHeight;

                    })
                    .delegate('.apiUrlExpand', 'change', function (evt) {
                        //Update the API URL choice.
                        var item = $(evt.target),
                            url = item.val(),
                            form = item.parents('form').first();

                        if (url) {
                            updateApiUrl(form, url);
                        }
                    })
                    .delegate('.urlParam', 'keyup', changeApiUrl)
                    .delegate('.urlParamSelect', 'change', changeApiUrl)
                    //Handle play form submissions.
                    .delegate('.apiCall', 'submit', function (evt) {
                        var form = $(evt.target),
                            method = form[0].raindropApiMethod,
                            inputs = form.find('.requestParams input, .requestParams select'),
                            url = form.find('.apiUrl').html(),
                            editableUrl = form.find('.editApiUrl'),
                            requestBody = form.find('.requestBody').val().trim(),
                            data = {};

                        evt.preventDefault();

                        //If there was a parameterized URL, favor that
                        if (!form.find('.parameterUrl').hasClass('hidden') && editableUrl.length) {
                            url = editableUrl.val().trim();
                            if (url.indexOf('{') !== -1) {
                                alert('Please edit URL parameters to make a valid URL');
                                return;
                            }
                        }

                        //Put together the request attributes.
                        inputs.each(function (i, node) {
                            var value = $(node).val();
                            if (value) {
                                data[node.name] = value;
                            }
                        });

                        //If a request body, then favor that for the data
                        if (method.body && requestBody) {
                            if (inputs.length) {
                                //Already have some data, need to clear
                                //it out, add it to the URL as query args
                                //to the URL. This is actually a bit goofy,
                                //should just have all query args or all
                                //body args. prefs/set is one API that goes here.
                                url += (url.indexOf('?') === -1 ? '?' : '&') +
                                      $.param(data);
                            }

                            data = requestBody;
                        }

                        //Construct the data call.
                        $.ajax({
                            type: 'POST',
                            url: url,
                            data: data,
                            processData: !method.body,
                            contentType: (method.body ?
                                        'application/json; charset=UTF-8' :
                                        'application/x-www-form-urlencoded; charset=UTF-8'),
                            success: function (data, textStatus, xhr) {
                                form.find('.output').html(jig.render(jig.cache('jsonResult'), data));
                            },
                            error: function (xhr, textStatus, errorThrown) {
                                form.find('.output').html(jig.render(jig.cache('jsonResult'), {
                                    ERROR: xhr.responseText
                                }));
                            }
                        });
                    })
                    //Handle close action for an API Call form
                    .delegate('form .apiCallClose', 'click', function (evt) {
                        evt.preventDefault();
                        $(evt.target).parents('form').remove();
                    })
                    //Handle expanding and closing of sections in the JSON response
                    //for API calls
                    .delegate('.expander', 'click', function (evt) {
                        var button = $(evt.target),
                            listNode = button.next('ul,ol')[0];
                        if (button.hasClass('closed')) {
                            listNode.style.display = '';
                            button.removeClass('closed');
                            button.html('&#9660;');
                        } else {
                            listNode.style.display = 'none';
                            button.addClass('closed');
                            button.html('&#9658;');
                        }
                        return false;
                    });
            });
        },
        error: function (xhr, textStatus, errorThrown) {
            $('#content').html(jig.htmlEscape(xhr.responseText));
        }
    });
});
