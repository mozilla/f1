from linkdrop.lib.oauth.facebook_ import FacebookResponder
#from linkdrop.lib.oauth.google_ import GoogleResponder
#from linkdrop.lib.oauth.live_ import LiveResponder
#from linkdrop.lib.oauth.openidconsumer import OpenIDResponder
from linkdrop.lib.oauth.twitter_ import TwitterResponder
#from linkdrop.lib.oauth.yahoo_ import YahooResponder

__all__ = ['get_provider']

# XXX need a better way to do this
_providers = {
    TwitterResponder.domain:  TwitterResponder,
    FacebookResponder.domain: FacebookResponder
}

def get_provider(provider):
    return _providers.get(provider)
