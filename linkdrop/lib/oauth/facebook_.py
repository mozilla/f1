# based on code from velruse

import urlparse
try:
     from urlparse import parse_qs
except ImportError:
     from cgi import parse_qs
import json
import httplib2

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from linkdrop.lib.oauth.base import OAuth2

# borrowed from velruse
def extract_fb_data(data):
     # Setup the normalized poco contact object
     nick = None
     
     # Setup the nick and preferred username to the last portion of the
     # FB link URL if its not their ID
     link = data.get('link')
     if link:
          last = link.split('/')[-1]
          if last != data['id']:
               nick = last

     profile = {
         'providerName': 'Facebook',
         'identifier': 'https://graph.facebook.com/%s' % data['id'],
         'displayName': data['name'],
         'emails': [data.get('email')],
         'verifiedEmail': data['verified'] and data.get('email'),
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
          profile['birthday'] = '-'.join(yr, mth, day)
     name = {}
     pcard_map = {'first_name': 'givenName', 'last_name': 'familyName'}
     for key, val in pcard_map.items():
          part = data.get(key)
          if part:
               name[val] = part
     name['formatted'] = data.get('name')
     
     profile['name'] = name
     
     # Now strip out empty values
     for k, v in profile.items():
          if not v or (isinstance(v, list) and not v[0]):
               del profile[k]
     
     return profile


class FacebookResponder(OAuth2):
     """Handle Facebook OAuth login/authentication"""

     profile_url = 'https://graph.facebook.com/me'
     domain = 'facebook.com'

     def __init__(self):
          OAuth2.__init__(self, self.domain)
          self.authorization_url = 'https://graph.facebook.com/oauth/authorize'
          self.access_token_url = 'https://graph.facebook.com/oauth/access_token'

     def get_credentials(self, access_token):
          fields = 'id,first_name,last_name,name,link,birthday,email,website,verified,picture,gender,timezone'
          client = httplib2.Http()
          resp, content = client.request(url(self.profile_url, access_token=access_token, fields=fields))
          if resp['status'] != '200':
               raise Exception("Error status: %r", resp['status'])

          fb_profile = json.loads(content)
          
          profile = extract_fb_data(fb_profile)
          result_data = {'profile': profile,
                         'oauth_token': access_token}
          
          return result_data

