# pycurl and certificates are a real PITA on Windows and the python
# openid library doesn't offer a reasonable way of adding default
# options to the curl object it uses.
import sys, os

def monkeypatch_curl(cert_path):
    # Use the specified cert_path by default.
    import pycurl
    real_curl = pycurl.Curl
    def monkeyed_curl():
        c = real_curl()
        c.setopt(c.CAINFO, cert_path)
        return c
    pycurl.Curl = monkeyed_curl

if sys.platform.startswith("win"):
    try:
        # use the same env var as the curl cmdline tool.
        monkeypatch_curl(os.environ["CURL_CA_BUNDLE"])
    except KeyError: # no env var setup - leave things alone
        pass
del os, sys, monkeypatch_curl
