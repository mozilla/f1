from linkdrop.lib.oauth import facebook_
#from linkdrop.lib.oauth.google_ import GoogleResponder
#from linkdrop.lib.oauth.live_ import LiveResponder
#from linkdrop.lib.oauth.openidconsumer import OpenIDResponder
from linkdrop.lib.oauth import twitter_
#from linkdrop.lib.oauth.yahoo_ import YahooResponder

__all__ = ['get_provider']

# XXX need a better way to do this
_providers = {
    twitter_.domain:  twitter_,
    facebook_.domain: facebook_
}

def get_provider(provider):
    return _providers.get(provider)
