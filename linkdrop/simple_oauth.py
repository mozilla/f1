# Copyright 2010 Google Inc.
# Portions copyright Mozilla Messaging 2010.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
     # http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Code lifted from google's XOAUTH sample; almost identical to that sample
# but with print statements removed or replaced with logging.
# Also added some raindrop-specific helper functions...

"""Utilities for XOAUTH authentication.

This script has the following modes of operation:
  --generate_oauth_token
  --generate_xoauth_string
  --test_imap_authentication
  --test_smtp_authentication

The --generate_oauth_token mode will generate and authorize an OAuth token for
testing.

  xoauth --generate_oauth_token --user=xxx@googlemail.com

The script will converse with Google Accounts and generate an oauth request
token, then present you with a URL you should visit in your browser to authorize
the token. Once you get the verification code from the website, enter it into
the script to get your OAuth access token. The output from this command will be
two values: an OAuth token and an OAuth token secret. These values are reusable,
so if you save them somewhere you won't have to keep repeating this first step.

The --generate_xoauth_string option generates an XOauth auth string that can
be fed directly to IMAP or SMTP.

(3-legged OAuth)
  xoauth --generate_xoauth_string --user=xxx@googlemail.com
    --oauth_token=k99hfs9dh --oauth_token_secret=sd9fhidfskfj

(2-legged OAuth)
  xoauth --generate_xoauth_string --user=xxx@googlemail.com
    --consumer_key=foo.com --consumer_secret=sd9fhidfskfj
    --xoauth_requestor_id=xxx@googlemail.com

The output of this mode will be a base64-encoded string. To use it, connect to
imap.googlemail.com:993 and pass it as the second argument to the AUTHENTICATE
command.

  a AUTHENTICATE XOAUTH a9sha9sfs[...]9dfja929dk==

The --test_imap_authentication and --test_smtp_authentication comands generate
an XOAUTH string and use them to authenticate to a live IMAP or SMTP server.
You can use the --imap_hostname and --smtp_hostname options to specify the
server to connect to.

  xoauth --test_imap_authentication --user=xxx@googlemail.com
    --oauth_token=k99hfs9dh --oauth_token_secret=sd9fhidfskfj

  xoauth --test_smtp_authentication --user=xxx@googlemail.com
    --oauth_token=k99hfs9dh --oauth_token_secret=sd9fhidfskfj

"""

import base64
import hmac
import imaplib
import random
import hashlib
import smtplib
import sys
import time
import urllib
import logging

logger = logging.getLogger(__name__)


def UrlEscape(text):
  # See OAUTH 5.1 for a definition of which characters need to be escaped.
  return urllib.quote(text, safe='~-._')


def UrlUnescape(text):
  # See OAUTH 5.1 for a definition of which characters need to be escaped.
  return urllib.unquote(text)


def FormatUrlParams(params):
  """Formats parameters into a URL query string.

  Args:
    params: A key-value map.

  Returns:
    A URL query string version of the given parameters.
  """
  param_fragments = []
  for param in sorted(params.iteritems(), key=lambda x: x[0]):
    param_fragments.append('%s=%s' % (param[0], UrlEscape(param[1])))
  return '&'.join(param_fragments)


def EscapeAndJoin(elems):
  return '&'.join([UrlEscape(x) for x in elems])


def GenerateSignatureBaseString(method, request_url_base, params):
  """Generates an OAuth signature base string.

  Args:
    method: The HTTP request method, e.g. "GET".
    request_url_base: The base of the requested URL. For example, if the
      requested URL is
      "https://mail.google.com/mail/b/xxx@googlemail.com/imap/?" +
      "xoauth_requestor_id=xxx@googlemail.com", the request_url_base would be
      "https://mail.google.com/mail/b/xxx@googlemail.com/imap/".
    params: Key-value map of OAuth parameters, plus any parameters from the
      request URL.

  Returns:
    A signature base string prepared according to the OAuth Spec.
  """
  return EscapeAndJoin([method, request_url_base, FormatUrlParams(params)])


def GenerateHmacSha1Signature(text, key):
  digest = hmac.new(key, text, hashlib.sha1)
  return base64.b64encode(digest.digest())


def GenerateOauthSignature(base_string, consumer_secret, token_secret):
  key = EscapeAndJoin([consumer_secret, token_secret])
  return GenerateHmacSha1Signature(base_string, key)


def ParseUrlParamString(param_string):
  """Parses a URL parameter string into a key-value map.

  Args:
    param_string: A URL parameter string, e.g. "foo=bar&oof=baz".

  Returns:
    A key-value dict.
  """
  kv_pairs = param_string.split('&')
  params = {}
  for kv in kv_pairs:
    k, v = kv.split('=')
    params[k] = UrlUnescape(v)
  return params


class OAuthEntity(object):
  """Represents consumers and tokens in OAuth."""

  def __init__(self, key, secret, **rest):
    self.key = key
    self.secret = secret
    for n, v in rest.iteritems():
      setattr(self, n, v)

  def __repr__(self):
    return "<OAuthEntity(%r)>" % self.__dict__


def FillInCommonOauthParams(params, consumer, nonce=None, timestamp=None):
  """Fills in parameters that are common to all oauth requests.

  Args:
    params: Parameter map, which will be added to.
    consumer: An OAuthEntity representing the OAuth consumer.
    nonce: optional supplied nonce
    timestamp: optional supplied timestamp
  """
  params['oauth_consumer_key'] = consumer.key
  if nonce:
    params['oauth_nonce'] = nonce
  else:
    params['oauth_nonce'] = str(random.randrange(2**64 - 1))
  params['oauth_signature_method'] = 'HMAC-SHA1'
  params['oauth_version'] = '1.0'
  if timestamp:
    params['oauth_timestamp'] = timestamp
  else:
    params['oauth_timestamp'] = str(int(time.time()))


def GenerateRequestToken(consumer, scope, nonce, timestamp, callback_url,
                         google_accounts_url_generator):
  """Generates an OAuth request token by talking to Google Accounts.

  Args:
    consumer: An OAuthEntity representing the OAuth consumer.
    scope: Scope for the OAuth access token.
    nonce: The nonce to use in the signature. If None is passed, a random nonce
      will be generated.
    timestamp: Timestamp to use in the signature. If None is passed, the current
      time will be used.
    google_accounts_url_generator: function that creates a Google Accounts URL
      for the given URL fragment.

  Returns:
    An OAuthEntity representing the request token.
  """
  params = {}
  FillInCommonOauthParams(params, consumer, nonce, timestamp)
  #params['oauth_callback'] = 'oob'
  params['oauth_callback'] = callback_url
  params['scope'] = scope
  request_url = google_accounts_url_generator.GetRequestTokenUrl()
  token = OAuthEntity(None, '')
  base_string = GenerateSignatureBaseString('GET', request_url, params)
  signature = GenerateOauthSignature(base_string, consumer.secret,
                                     token.secret)
  params['oauth_signature'] = signature

  url = '%s?%s' % (request_url, FormatUrlParams(params))
  response = urllib.urlopen(url).read()
  response_params = ParseUrlParamString(response)
  
  # for param in response_params.items():
  #  print '%s: %s' % param

  key = response_params.pop('oauth_token')
  secret = response_params.pop('oauth_token_secret')
  token = OAuthEntity(key, secret, **response_params)

  #print ('To authorize token, visit this url and follow the directions '
  #       'to generate a verification code:')

  #print '  %s?oauth_token=%s' % (
  #    google_accounts_url_generator.GetAuthorizeTokenUrl(),
  #    UrlEscape(response_params['oauth_token']))
  return token


def GetAccessToken(consumer, request_token, oauth_verifier,
                   google_accounts_url_generator):
  """Obtains an OAuth access token from Google Accounts.

  Args:
    consumer: An OAuth entity representing the OAuth consumer.
    request_token: An OAuthEntity representing the request token (e.g. as
      returned by GenerateRequestToken.
    oauth_verifier: The verification string displayed to the user after
      completing Google Accounts authorization.
    google_accounts_url_generator: function that creates a Google Accounts URL
      for the given URL fragment.

  Returns:
    An OAuthEntity representing the OAuth access token.
  """
  params = {}
  FillInCommonOauthParams(params, consumer)
  params['oauth_token'] = request_token.key
  params['oauth_verifier'] = oauth_verifier
  request_url = google_accounts_url_generator.GetAccessTokenUrl()
  base_string = GenerateSignatureBaseString('GET', request_url, params)
  signature = GenerateOauthSignature(base_string, consumer.secret,
                                     request_token.secret)
  params['oauth_signature'] = signature

  url = '%s?%s' % (request_url, FormatUrlParams(params))
  response = urllib.urlopen(url).read()
  response_params = ParseUrlParamString(response)
  #for param in ('oauth_token', 'oauth_token_secret'):
  #  print '%s: %s' % (param, response_params[param])
  key = response_params.pop('oauth_token')
  secret = response_params.pop('oauth_token_secret')
  return OAuthEntity(key, secret, **response_params)


def GenerateXOauthString(consumer, access_token, user, proto,
                         xoauth_requestor_id, nonce, timestamp):
  """Generates an IMAP XOAUTH authentication string.

  Args:
    consumer: An OAuthEntity representing the consumer.
    access_token: An OAuthEntity representing the access token.
    user: The Google Mail username (full email address)
    proto: "imap" or "smtp", for example.
    xoauth_requestor_id: xoauth_requestor_id URL parameter for 2-legged OAuth
    nonce: optional supplied nonce
    timestamp: optional supplied timestamp

  Returns:
    A string that can be passed as the argument to an IMAP
    "AUTHENTICATE XOAUTH" command after being base64-encoded.
  """
  method = 'GET'
  url_params = {}
  if xoauth_requestor_id:
    url_params['xoauth_requestor_id'] = xoauth_requestor_id
  oauth_params = {}
  FillInCommonOauthParams(oauth_params, consumer, nonce, timestamp)
  if access_token.key:
    oauth_params['oauth_token'] = access_token.key
  signed_params = oauth_params.copy()
  signed_params.update(url_params)
  request_url_base = (
      'https://mail.google.com/mail/b/%s/%s/' % (user, proto))
  base_string = GenerateSignatureBaseString(
      method,
      request_url_base,
      signed_params)
  logger.debug('signature base string: %s', base_string)
  signature = GenerateOauthSignature(base_string, consumer.secret,
                                     access_token.secret)
  oauth_params['oauth_signature'] = signature

  formatted_params = []
  for k, v in sorted(oauth_params.iteritems()):
    formatted_params.append('%s="%s"' % (k, UrlEscape(v)))
  param_list = ','.join(formatted_params)
  if url_params:
    request_url = '%s?%s' % (request_url_base,
                             FormatUrlParams(url_params))
  else:
    request_url = request_url_base
  preencoded = '%s %s %s' % (method, request_url, param_list)
  logger.debug('xoauth string: %s' + preencoded)
  return preencoded

class GoogleAccountsUrlGenerator:
  def __init__(self, user):
    self.__apps_domain = None
    at_index = user.find('@')
    if at_index != -1 and (at_index + 1) < len(user):
      domain = user[(at_index + 1):].lower()
      if domain != 'gmail.com' and domain != 'googlemail.com':
        self.__apps_domain = domain

  def GetRequestTokenUrl(self):
    return 'https://www.google.com/accounts/OAuthGetRequestToken'

  def GetAuthorizeTokenUrl(self):
    if self.__apps_domain:
      return ('https://www.google.com/a/%s/OAuthAuthorizeToken' %
              self.__apps_domain)
    else:
      return 'https://www.google.com/accounts/OAuthAuthorizeToken'

  def GetAccessTokenUrl(self):
    return 'https://www.google.com/accounts/OAuthGetAccessToken'

# Some raindrop specific stuff...

class TwitterAccountsUrlGenerator:

  def GetRequestTokenUrl(self):
    return 'http://twitter.com/oauth/request_token'

  def GetAuthorizeTokenUrl(self):
    return 'http://twitter.com/oauth/authorize'

  def GetAccessTokenUrl(self):
    return 'http://twitter.com/oauth/access_token'

def getOAuthUrlGenerator(provider, user):
  if provider == 'twitter.com':
    return TwitterAccountsUrlGenerator()
  elif provider in ['gmail.com', 'google.com']:
    return GoogleAccountsUrlGenerator(user)
  else:
    raise Exception('OAuth provider %s not supported' % provider)

def GenerateXOauthStringFromAcctInfo(protocol, acct_info):
  """Generates an IMAP XOAUTH authentication string from a raindrop
  'account info' dictionary.
  """
  username = acct_info.username
  oauth_token = getattr(acct_info, 'oauth_token', None)
  oauth_token_secret = getattr(acct_info, 'oauth_token_secret', None)
  consumer_key = getattr(acct_info, 'oauth_consumer_key', 'anonymous')
  consumer_secret = getattr(acct_info, 'oauth_consumer_secret', 'anonymous')
  consumer = OAuthEntity(consumer_key, consumer_secret)
  google_accounts_url_generator = GoogleAccountsUrlGenerator(username)
  access_token = OAuthEntity(oauth_token, oauth_token_secret)
  xoauth_requestor_id = None
  # the utility functions above will generate nonce and timestamps for us
  nonce = None
  timestamp = None
  xoauth_string = GenerateXOauthString(
                      consumer, access_token, username, protocol,
                      xoauth_requestor_id, nonce, timestamp)
  return xoauth_string 


def AcctInfoSupportsOAuth(acct_info):
  # A reflection on the need to have a URL generator per provider is that
  # we only support gmail for now...
  is_google = getattr(acct_info, 'kind', None) == 'gmail' or \
              getattr(acct_info, 'host', '').endswith('gmail.com')
  return is_google and getattr(acct_info, 'oauth_token', None) and getattr(acct_info, 'oauth_token_secret', None)
