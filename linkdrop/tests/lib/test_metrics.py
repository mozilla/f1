from linkdrop.lib import metrics
from linkdrop.tests import TestController
from mock import Mock
from nose import tools

class TestMetricsConsumer(TestController):
    @tools.raises(NotImplementedError)
    def test_consume_raises_notimplemented(self):
        mc = metrics.MetricsConsumer()
        mc.consume('somedata')

class TestMetricsCollector(TestController):
    def setUp(self):
        self.consumer = Mock()
        self.collector = metrics.MetricsCollector(self.consumer)

    def test_get_distinct_attr(self):
        res = self.collector._get_distinct_attrs(None)
        tools.eq_(res, dict())
        distinct_ob = dict(foo='bar', baz='bawlp')
        res = self.collector._get_distinct_attrs(distinct_ob)
        tools.eq_(res, distinct_ob)
        tools.assert_raises(NotImplementedError,
                            self.collector._get_distinct_attrs,
                            list())

    def test_track_not_enabled(self):
        self.collector.enabled = False
        distinct_ob = dict(foo='bar', baz='bawlp')
        self.collector.track(distinct_ob, 'id')
        self.consumer.consume.assert_not_called()

    def test_track(self):
        distinct_ob = dict(foo='bar', baz='bawlp')
        self.collector.track(distinct_ob, 'id', hey='now')
        self.consumer.consume.assert_called_once()
        data = self.consumer.consume.call_args[0][0]
        tools.ok_(data.pop('when', False))
        distinct_ob.update(dict(id='id', hey='now'))
        tools.eq_(data, distinct_ob)
