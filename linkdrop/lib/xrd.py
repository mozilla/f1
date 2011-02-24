from datetime import datetime
import httplib2
import xml.etree.cElementTree as et

NS = "http://docs.oasis-open.org/ns/xri/xrd-1.0"

def findall(elem, name, ns="http://docs.oasis-open.org/ns/xri/xrd-1.0"):
    return elem.findall("{%s}%s" %(ns,name))

def find(elem, name, ns="http://docs.oasis-open.org/ns/xri/xrd-1.0"):
    return elem.find("{%s}%s" %(ns,name))
    

def parse_xrd(content):
    """an extensible XRD parser. The basic functionality is to take a file pointer and 
    parse the XRD. You can extend this by defining new utilities for parsing additional namespaces."""

    elem = et.fromstring(content)
    expires = find(elem, 'Expires')
    if expires is not None:
        expires = datetime.strptime(expires.text,"%Y-%m-%dT%H:%M:%SZ")
    type_ = find(elem, 'Type')
    if type_ is not None:
        type_ = type_.text
    subject = find(elem, 'Subject')
    if subject is not None:
        subject = subject.text
    aliases = findall(elem, 'Alias')
    aliases = [alias.text for alias in aliases]
    properties = [(p.attrib.get('type'), p.text) for p in findall(elem, 'Property')]

    resource = {
        "subject": subject,
        "aliases": aliases,
        "expires": expires,
        "type": type_,
        "properties": properties,
        "links": []
    }
                        
    # now add links
    links = findall(elem, 'Link')
    resource_set = resource['links']

    for link in links:
        resource_link = {
            "rels": [rel.text for rel in findall(link, 'Rel')],
            "media_types": [mt.text for mt in findall(link, 'MediaType')],
            "uris": [uri.text for uri in findall(link, 'URI')],
            "templates": [tmpl.text for tmpl in findall(link,"URITemplate")],
            "priority": int(link.attrib.get("priority","0"))
        }
        if link.attrib.get("rel", None):
            resource_link['rels'].append(link.attrib.get("rel"))
        if link.attrib.get("href", None):
            resource_link['uris'].append(link.attrib.get("href"))
        if link.attrib.get("type", None):
            resource_link['media_types'].append(link.attrib.get("type"))
        resource_set.append(resource_link)
    return resource


def discover(domain, rel):
    host_meta = "http://%s/.well-known/host-meta" % domain
    resp, content = httplib2.Http().request(host_meta)
    if resp['status'] != '200':
        raise Exception("Error status: %r", resp['status'])
    res = parse_xrd(content)
    #print repr(res)
    href = None
    for link in res['links']:
        if rel in link['rels']:
            href = link['uris'][0]

    if not href:
        raise Exception("unable to locate service")
    resp, content = httplib2.Http().request(href)
    if resp['status'] != '200':
        raise Exception("Error status: %r", resp['status'])
    
    return parse_xrd(content)

_oexchange = {
    'http://www.oexchange.org/spec/0.8/prop/vendor': 'vendor',
    'http://www.oexchange.org/spec/0.8/prop/title': 'title',
    'http://www.oexchange.org/spec/0.8/prop/name': 'name',
    'http://www.oexchange.org/spec/0.8/prop/prompt': 'prompt',
    'http://www.oexchange.org/spec/0.8/rel/offer': 'endpoint'
}
def oexchange_service(domain):
    xrd = discover(domain, 'http://oexchange.org/spec/0.8/rel/resident-target')
    #print xrd
    service = {
        'domain': domain
    }
    for l in xrd['links']:
        if len(l['uris']):
            service[_oexchange.get(l['rels'][0],l['rels'][0])] = l['uris'][0]
    for p in xrd['properties']:
        if p[1]:
            service[_oexchange.get(p[0], p[0])] = p[1]
    return service
    
if __name__ == '__main__':
    import sys
    print oexchange_service(sys.argv[1])
    
    
