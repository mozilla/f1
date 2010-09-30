# partially based on code from velruse

import urlparse
try:
     from urlparse import parse_qs
except ImportError:
     from cgi import parse_qs
import json
import httplib2
import urllib
import random

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from linkdrop.lib.oauth.base import OAuth2

domain = 'facebook.com'


# this function is a derivative of:
# http://code.activestate.com/recipes/146306-http-client-to-post-using-multipartform-data/
## {{{ http://code.activestate.com/recipes/146306/ (r1)
def encode_multipart_formdata(body):
    BOUNDARY = '----------$_BOUNDARY_' + str(random.getrandbits(128)) + '_$'
    CRLF = '\r\n'
    L = []
    for key in body:
        L.append('--' + BOUNDARY)
        L.append('Content-Disposition: form-data; name="%s"' % key)
        L.append('')
        L.append(body[key])
    L.append('--' + BOUNDARY + '--')
    L.append('')
    body = CRLF.join(L)
    content_type = 'multipart/form-data; boundary=%s' % BOUNDARY
    return content_type, body

# borrowed from velruse
def extract_fb_data(data):
     #import sys; print >> sys.stderr, data
     # Setup the normalized poco contact object
     nick = None
     
     # Setup the nick and preferred username to the last portion of the
     # FB link URL if its not their ID
     # if a user sets up their personal link, they get a url that looks like:
     # https://www.facebook.com/mixedpuppy, otherwise they have something
     # like: http://www.facebook.com/profile.php?id=100001556529144
     link = data.get('link')
     if link:
          link = urlparse.urlparse(link)
          path = link.path[1:].split('/')[0]
          if not link.query and path is not 'profile.php' and path is not data['id']:
               nick = path

     profile = {
         'providerName': 'Facebook',
         'identifier': 'https://graph.facebook.com/%s' % data['id'],
         'displayName': data['name'],
         'emails': [data.get('email')],
         'verifiedEmail': data.get('verified') and data.get('email'),
         'gender': data.get('gender'),
         'preferredUsername': nick or data['name'],
     }

     account = {'domain': 'facebook.com',
                'userid': data['id'],
                'username': nick or data['name'] }
     profile['accounts'] = [account]

     tz = data.get('timezone')
     if tz:
          parts = str(tz).split(':')
          if len(parts) > 1:
               h, m = parts
          else:
               h, m = parts[0], '00'
          if len(h) < 3:
               h = '%s0%s' % (h[0], h[1])
          data['utfOffset'] = ':'.join([h, m])
     bday = data.get('birthday')
     if bday:
          mth, day, yr = bday.split('/')
          profile['birthday'] = '-'.join([yr, mth, day])
     name = {}
     pcard_map = {'first_name': 'givenName', 'last_name': 'familyName'}
     for key, val in pcard_map.items():
          part = data.get(key)
          if part:
               name[val] = part
     name['formatted'] = data.get('name')
     
     profile['name'] = name
     
     # facebook gives us an absolute url, these work and redirect to their CDN
     profile['photos'] = [
            {'type':"thumbnail", 'value':"https://graph.facebook.com/" + data['id'] + "/picture?type=square"},
            {'type':"profile",   'value':"https://graph.facebook.com/" + data['id'] + "/picture?type=large"}
          ]

     # Now strip out empty values
     for k, v in profile.items():
          if not v or (isinstance(v, list) and not v[0]):
               del profile[k]
     
     return profile


class responder(OAuth2):
     """Handle Facebook OAuth login/authentication"""

     profile_url = 'https://graph.facebook.com/me'
     domain = 'facebook.com'

     def __init__(self):
          OAuth2.__init__(self, domain)

     def _get_credentials(self, access_token):
          profile_url = config.get("oauth.facebook.com.profile", self.profile_url)
          fields = 'id,first_name,last_name,name,link,birthday,email,website,verified,picture,gender,timezone'
          client = httplib2.Http()
          resp, content = client.request(url(profile_url, access_token=access_token, fields=fields))
          if resp['status'] != '200':
               raise Exception("Error status: %r", resp['status'])

          fb_profile = json.loads(content)
          
          profile = extract_fb_data(fb_profile)
          result_data = {'profile': profile,
                         'oauth_token': access_token}
          
          return result_data

class api():
     def __init__(self, account):
          self.access_token = account.get('oauth_token')
          
     def rawcall(self, url, body):
          url = url +"?"+urllib.urlencode(dict(access_token=self.access_token))

          content_type, body = encode_multipart_formdata(body)
          headers = {
               'Content-type': content_type,
               'Content-Length': str(len(body))
          }
          resp, content = httplib2.Http().request(url, 'POST', headers=headers, body=body)

          response = json.loads(content)
          result = error = None
          if 'id' in response:
              result = response
              result['facebook.com'] = response['id']
          elif 'error' in response:
              error = {'provider': domain,
                       'reason': response['error'].get('message'),
                       'type': response['error'].get('type'),
                       'code': int(resp['status']) 
              }
          else:
              error = {'provider': domain,
                       'reason': "unexpected facebook response: %r"% (response,),
                       'code': int(resp['status']) 
              }
              log.error("unexpected facebook response: %r", response)

          return result, error

     def sendmessage(self, message, options={}):
          url = config.get("oauth.facebook.com.feed", "https://graph.facebook.com/me/feed")
          body = {
               "message": message
          }

          for arg in ['link', 'name', 'description', 'picture']:
               if arg in options:
                    body[arg] = options[arg]

          return self.rawcall(url, body)


