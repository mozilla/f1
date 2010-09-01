import logging
import urllib, cgi, json

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from pylons.decorators import jsonify
from pylons.decorators.util import get_pylons

from linkdrop import simple_oauth
from linkdrop.lib.base import BaseController, render
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg

from linkdrop.model.meta import Session
from linkdrop.model.account import Account
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy import and_

log = logging.getLogger(__name__)


def get_oauth_config(provider):
    key = 'oauth.'+provider+'.'
    keylen = len(key)
    d = {}
    for k,v in config.items():
        if k.startswith(key):
            d[k[keylen:]] = v
    return d
    
def get_oauth_consumer(oauth_config):
    return simple_oauth.OAuthEntity(oauth_config['consumer_key'], oauth_config['consumer_secret'])


class AccountController(BaseController):
    """
Accounts
========

The 'account' namespace is used to access information regarding the current
user's account. This does not retrieve the users contact, for that see
the contacts API that uses @me/@self.

"""
    __api_controller__ = True # for docs

    # for testing...
    @api_response
    @json_exception_response
    def get(self, id=None):
        if id is None:
            accts = Session.query(Account).all()
        else:
            accts = [Session.query(Account).get(id)]
        return [a.to_dict() for a in accts]

    @json_exception_response
    def oauth_start(self, *args, **kw):
        pylons = get_pylons(args)
        try:
            domain = request.params.get('domain')
            return_path = request.params['return_to']
        except KeyError, what:
            raise ValueError("'%s' request param is not optional" % (what,))

        scope = request.params.get('scope', domain)

        oauth_config = get_oauth_config(domain)
        url_gen = simple_oauth.getOAuthUrlGenerator(domain, '')

        consumer = get_oauth_consumer(oauth_config)
        callback_url = url(controller='account', action="oauth_done",
                           qualified=True, domain=domain,
                           return_to=return_path)

        csrf_token = request.environ.get('CSRF_TOKEN')
        if csrf_token:
            callback_url += '&rd-token=%s' % (csrf_token)

        # Note the xoauth module automatically generates nonces and timestamps to prevent replays.)
        request_entity = simple_oauth.GenerateRequestToken(consumer, scope, None, None,
                                                         callback_url, url_gen)

        # Save the request secret into the session.
        session["oauth_request_key"] = request_entity.key
        session["oauth_request_secret"] = request_entity.secret
        session.save()

        # And arrange for the client to redirect to the service to continue
        # the process...
        loc = '%s?oauth_token=%s' % (url_gen.GetAuthorizeTokenUrl(),
                                     simple_oauth.UrlEscape(request_entity.key))
        log.info("redirecting to %r and requesting to land back on %r",
                 loc, callback_url)
        pylons.response.headers['Location'] = loc
        pylons.response.status_int = 302

    @json_exception_response
    def oauth_done(self, *args, **kw):
        pylons = get_pylons(args)
        try:
            domain = request.params['domain']
            return_path = request.params['return_to']
        except KeyError, what:
            raise ValueError("'%s' request param is not optional" % (what,))

        oauth_config = get_oauth_config(domain)
        url_gen = simple_oauth.getOAuthUrlGenerator(domain, '')

        oauth_token = request.params['oauth_token']
        oauth_verifier = request.params['oauth_verifier']
        # Get the request secret from the session.
        # Save the request secret into the session.
        user_key = session.get('userkey')
        request_key = session.pop("oauth_request_key")
        request_secret = session.pop("oauth_request_secret")

        if request_secret and request_key == oauth_token:
            request_token = simple_oauth.OAuthEntity(oauth_token, request_secret)
            consumer = get_oauth_consumer(oauth_config)
            # Make the oauth call to get the final verified token
            verified_token = simple_oauth.GetAccessToken(consumer, request_token,
                                                       oauth_verifier, url_gen)

            if domain == "twitter.com":
                userid = verified_token.user_id
                username = verified_token.screen_name
            else:
                raise ValueError(domain) # can't obtain user information for this provider...
            # Find or create an account
            try:
                acct = Session.query(Account).filter(and_(Account.domain==domain, Account.userid==userid)).one()
            except NoResultFound:
                acct = Account()
                acct.domain = domain
                acct.userid = userid
                acct.username = username
                if user_key:
                    acct.userkey = user_key
                Session.add(acct)
                
            if not user_key:
                session['userkey'] = acct.userkey

            # Update the account with the final tokens and delete the transient ones.
            acct.oauth_token = verified_token.key
            acct.oauth_token_secret = verified_token.secret
            
            Session.commit()
            fragment = "oauth_success_" + domain
        else:
            fragment = "oauth_failure_" + domain

        session.save()

        # and finally redirect back to the signup page.
        loc = request.host_url + return_path + "#" + fragment.replace(".", "_")
        log.info("Final redirect back to %r", loc)
        pylons.response.headers['Location'] = loc
        pylons.response.status_int = 302

    @json_exception_response
    def oauth_facebook(self, redirect_info=None, *args, **kw):
        pylons = get_pylons(args)
        # NOTE: facebook insists the redirect URLS are identical for each
        # leg of the auth (ie, no 'oauth_start/oauth_done') and that the
        # redirect URL contains no request params (ie, no '?return_to=xxx' in
        # the URL.)  We worm around the second problem by encoding the params
        # as base64 and appending it to the URL itself (in which case it comes
        # to us via redirect_info)
        if redirect_info is None:
            # this is the initial request from linkdrop.
            return_to = request.params.get('return_to', None)
        else:
            # this is a redirected leg.
            return_to = redirect_info.decode("base64")

        domain = "facebook.com"
        # experimentation shows callback_url can not have request params!
        callback_url = url(controller='account', action="oauth_facebook",
                           redirect_info=return_to.encode("base64")[:-1],
                           qualified=True)
        csrf_token = request.environ.get('CSRF_TOKEN')
        if csrf_token:
            if '?' in callback_url:
                callback_url += '&rd-token=%s' % (csrf_token)
            else:
                callback_url += '?rd-token=%s' % (csrf_token)

        oauth_config = get_oauth_config(domain)

        args = dict(client_id=oauth_config['app_id'], redirect_uri=callback_url)
        verification_code = request.params.get("code")
        if not verification_code:
            # make the auth request to get the code.
            args['scope'] = request.params.get('scope', '')
            loc = "https://graph.facebook.com/oauth/authorize?" + urllib.urlencode(args)
            log.info("facebook auth redirecting to %r and requesting to land back on %r",
                     loc, callback_url)
        else:
            args["client_secret"] = oauth_config['app_secret']
            args["code"] = verification_code
            # must we really use urlopen here, or can we do it via redirects?
            resp = urllib.urlopen(
                "https://graph.facebook.com/oauth/access_token?" +
                urllib.urlencode(args))
            redirect_query = ""
            if resp.headers.get("content-type", "").startswith("text/javascript"):
                # almost certainly an error response.
                resp = json.load(resp)
                log.error("facebook auth request failed with %r", resp)
                fragment = "oauth_failure_" + domain
            else:
                response = cgi.parse_qs(resp.read())
                access_token = response["access_token"][-1]

                # Download the user profile and until we know what to do with
                # it, just log it!
                profile = json.load(urllib.urlopen(
                    "https://graph.facebook.com/me?" +
                    urllib.urlencode(dict(access_token=access_token))))
    
                from pprint import pformat
                log.info("facebook profile: %s", pformat(profile))

                if 'error' in profile:
                    log.error("facebook profile request failed with %r", profile)
                    fragment = "oauth_failure_" + domain
                else:
                    # Setup the linkdrop account.
                    facebookid = profile['id']
                    acct_proto = "facebook"
                    user_key = session.get('userkey')
                    # Try and find an account to use or create a new one.
                    try:
                        acct = Session.query(Account).filter(and_(Account.domain=="facebook.com", Account.userid==facebookid)).one()
                    except NoResultFound:
                        acct = Account()
                        acct.domain = "facebook.com"
                        acct.userid = facebookid
                        acct.username = ""
                        if user_key:
                            acct.userkey = user_key
                        else:
                            session['userkey'] = acct.userkey
                        Session.add(acct)

                    acct.oauth_token = access_token
                    Session.commit()
                    session.save()
                    fragment = "oauth_success_" + domain
                    redirect_query = "?" + urllib.urlencode(dict(id=acct.id, name=profile['name']))

            loc = request.host_url + return_to + redirect_query + "#" + fragment.replace(".", "_")
            log.info("Final redirect back to %r", loc)

        pylons.response.headers['Location'] = loc
        pylons.response.status_int = 302
