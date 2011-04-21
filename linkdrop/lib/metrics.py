# A simple metrics gathering interface for F1.
import time

_emptydict = {}


class MetricsConsumer(object):
    def consume(self, data):
        raise NotImplementedError


class MetricsCollector(object):
    def __init__(self, consumer):
        self.consumer = consumer
        self.enabled = True

    def _get_distinct_attrs(self, distinct_ob):
        # 'distinct attributes' are anything we want to group the metrics by -
        # eg, it may include the concept of a 'user', a 'remote address', etc.
        # if it is already a dict, assume it is already a set of attributes.
        if distinct_ob is None:
            return _emptydict
        if isinstance(distinct_ob, dict):
            return distinct_ob
        return self._distinct_object_to_attrs(distinct_ob)

    def _distinct_object_to_attrs(self, distinct_ob):
        raise NotImplementedError

    def track(self, distinct_ob, id, **data):
        if not self.enabled:
            return
        data.update(self._get_distinct_attrs(distinct_ob))
        # time can be formatted externally for lower perf impact here.
        data['when'] = time.time()
        data['id'] = id
        self.consumer.consume(data)

    def start_timer(self, distinct_ob, **init_data):
        init_data.update(self._get_distinct_attrs(distinct_ob))
        return TimedMetricsCollector(self, init_data)


class TimedMetricsCollector(object):
    def __init__(self, parent_collector, init_data):
        self.parent_collector = parent_collector
        self.init_data = init_data
        self.tracked = False
        self.started = time.time()

    def track(self, id, **data):
        assert not self.tracked
        self.tracked = True
        if self.init_data is not None:
            data.update(self.init_data)
        assert 'took' not in data, data
        data['took'] = time.time() - self.started
        self.parent_collector.track(None, id, **data)


# F1 specific stuff - should probably go into its own module once it gets
# more sophisticated or more options...
import logging
log = logging.getLogger('linkdrop-metrics')
errlog = logging.getLogger('linkdrop')


class F1MetricsConsumer(MetricsConsumer):
    def consume(self, data):
        # gozer has requested a simple format of name=value, space sep'd and
        # strings quoted.
        msg = " ".join(("%s=%r" % (n, v.encode("utf-8")
                                   if isinstance(v, unicode) else v)
                        for n, v in data.iteritems()))
        log.info("%s", msg)


class F1MetricsCollector(MetricsCollector):
    def _distinct_object_to_attrs(self, distinct_ob):
        # distinct_ob is expected to be a pylons 'request' object
        # a proxy is used in production, so prefer HTTP_X_FORWARDED_FOR
        try:
            remote_address = distinct_ob.environ['HTTP_X_FORWARDED_FOR']
        except KeyError:
            remote_address = distinct_ob.environ.get("REMOTE_ADDR")
        # discard the last octet of the IP address.  Will almost certainly
        # need work for IPv6 :)
        result = {}
        if remote_address:
            try:
                remote_address = ".".join(remote_address.split(".", 3)[:-1]) \
                                 + ".0"
            except (ValueError, IndexError), exc:
                errlog.error("failed to anonymize remote address %r: %s",
                             remote_address, exc)
            else:
                result['remote_address'] = remote_address
        return result


# the object used by the code.
metrics = F1MetricsCollector(F1MetricsConsumer())
