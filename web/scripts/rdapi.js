/*jslint plusplus: false, nomen: false, regexp: false */
/*global require: false, document: false, hex_md5: false, localStorage: false, console: false */
"use strict";

require.def('rdapi',
        ['require', 'jquery', 'blade/object', 'blade/jig', 'friendly', 'isoDate', 'md5'],
function (require,   $,        object,         jig,         friendly,   isoDate) {

    var rdapi,
        csrfHeader = 'X-CSRF',
        csrfRegExp = /csrf=([^\; ]+)/,
        contacts = {},
        jigFunctions = {
            contact: function (identity) {
                return identity.iid && identity.domain ? contacts[identity.iid] || {} : identity;
            },
            contactPhotoUrl: function (contact) {
                var url = 'i/face2.png', photos, mailaddr;
                contact = jigFunctions.contact(contact);
                photos = contact.photos;
                if (photos && photos.length) {
                    url = photos[0].value;
                    photos.forEach(function (photo) {
                        if (photo.primary) {
                            url = photo.value;
                        }
                    });
                } else 
                if (contact.emails && contact.emails.length) {
                    // gravatar as a default
                    mailaddr = contact.emails[0].value;
                    contact.emails.forEach(function (email) {
                        if (email.primary) {
                            mailaddr = email.value;
                        }
                    });
                    url = 'http://www.gravatar.com/avatar/' + hex_md5(mailaddr) + '?s=24 &d=identicon';
                }
                return url;
            },
            allMessages: function (conversation) {
                return [conversation.topic].concat(conversation.messages || []);
            },
            friendlyDate: function (isoString) {
                return friendly.date(isoDate(isoString)).friendly;
            },
            htmlBody: function (text) {
                return jig.htmlEscape(text).replace(/\n/g, '<br>');
            }
        },
        config = {
            baseUrl: '/',
            apiPath: 'api/',
            saveTemplateData: true
        };

    //Register functions with jig
    jig.addFn(jigFunctions);

    function normalize(options) {
        if (typeof options === 'string') {
            options = {
                template: options
            };
        } else if (options.templateId) {
            options.template = jig.cache(options.templateId);
        }

        if (!('attachData' in options)) {
            options.attachData = rdapi.attachTemplateData;
        }

        if (options.emptyTemplateId) {
            options.emptyTemplate = jig.cache(options.emptyTemplateId);
        }

        return options;
    }

    function getCsrfToken() {
        var token = csrfRegExp.exec(document.cookie);
        return token && token[1] ? token[1] : null;
    }

    function ajax(url, options) {
        options.url = config.baseUrl + config.apiPath + url;

        object.mixin(options, {
            limit: 30,
            message_limit: 3,
            dataType: 'json',
            error: function (xhr, textStatus, errorThrown) {
                console.log(errorThrown);
            }
        });

        var oldSuccess = options.success,
            csrfToken = getCsrfToken();

        //Intercept any success calls to get a hold of contacts from
        //any API call that returns them. Also be sure to remember any
        //user token
        options.success = function (json, textStatus, xhr) {
            if (json && json.contacts) {
                object.mixin(contacts, json.contacts, true);
            }
            if (oldSuccess) {
                return oldSuccess.apply(null, arguments);
            } else {
                return json;
            }
        };

        if (csrfToken) {
            options.beforeSend = function (xhr) {
                xhr.setRequestHeader(csrfHeader, csrfToken);
            };
        }

        $.ajax(options);
    }

    function finishApiTemplating(html, options) {
        var parentNode = options.forId ?
                         document.getElementById(options.forId) : null;
        if (parentNode) {
            parentNode.innerHTML = html;
        }

        if (options.onTemplateDone) {
            options.onTemplateDone(html);
        }

        $(document).trigger('rdapi-done', parentNode);
    }

    rdapi = function (url, options) {
        options = normalize(options);

        object.mixin(options, {
            success: function (json) {
                var template = options.template,
                    emptyTemplate = options.emptyTemplate,
                    html = '';

                if (options.forId && template) {
                    if (options.prop) {
                        json = jig.getObject(options.prop, json, options);
                    }

                    if (require.isArray(json)) {
                        if (!json.length) {
                            html += jig(emptyTemplate, json, options);
                        } else {
                            json.forEach(function (item) {
                                html += jig(template, item, options);
                            });
                        }
                    } else {
                        html += jig(!json ? emptyTemplate : template, json, options);
                    }

                    finishApiTemplating(html, options);
                }
            },
            error: function (xhr, textStatus, errorThrown) {
                if (options.emptyTemplate) {
                    var html = jig(options.emptyTemplate, errorThrown, options);
                    finishApiTemplating(html, options);
                } else {
                    throw errorThrown;
                }
            }
        });

        ajax(url, options);
    };

    rdapi.contactPhotoUrl = jigFunctions.contactPhotoUrl;

    rdapi.attachTemplateData = false;

    require.ready(function () {
        var apiOptions = [];

        //Build up lists of templates to use.
        jig.parse({
            //rdapi adds some additional semantics to some nodes,
            //to allow automatic API calls, so pull off those attributes
            //to use later for each template parsed.
            onBeforeParse: function (node) {
                var id = node.id,
                    api = node.getAttribute('data-rdapi'),
                    forId = node.getAttribute('data-rdfor'),
                    prop = node.getAttribute('data-rdprop');

                if (api) {
                    apiOptions.push({
                        templateId: id,
                        api: api,
                        forId: forId,
                        prop: prop
                    });
                }

                //Remove the data attributes specific to rdapi
                ['data-rdapi', 'data-rdprop', 'data-rdfor'].forEach(function (attr) {
                    node.removeAttribute(attr);
                });
            }
        });

        //Finally, do all the API calls. This is a separate loop because
        //all templates need to be strings before the api calls execute in
        //case subtemplates are needed.
        apiOptions.forEach(function (apiOption) {
            rdapi(apiOption.api, apiOption);
        });
    });

    return rdapi;
});
