# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Raindrop.
#
# The Initial Developer of the Original Code is
# Mozilla Messaging, Inc..
# Portions created by the Initial Developer are Copyright (C) 2009
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#

import sys, os, time

# Guard the import of cProfile such that 2.4 people without lsprof can still use
# this script.
try:
    from cProfile import Profile
except ImportError:
    try:
        from lsprof import Profile
    except ImportError:
        from profile import Profile

class ContextualProfile(Profile):
    """ A subclass of Profile that adds a context manager for Python
    2.5 with: statements and a decorator.
    source: kernprof.py
    """

    def __init__(self, *args, **kwds):
        super(ContextualProfile, self).__init__(*args, **kwds)
        self.enable_count = 0

    def enable_by_count(self, subcalls=True, builtins=True):
        """ Enable the profiler if it hasn't been enabled before.
        """
        if self.enable_count == 0:
            self.enable(subcalls=subcalls, builtins=builtins)
        self.enable_count += 1

    def disable_by_count(self):
        """ Disable the profiler if the number of disable requests matches the
        number of enable requests.
        """
        if self.enable_count > 0:
            self.enable_count -= 1
            if self.enable_count == 0:
                self.disable()

    def __call__(self, func):
        """ Decorate a function to start the profiler on function entry and stop
        it on function exit.
        """
        def f(*args, **kwds):
            self.enable_by_count()
            try:
                result = func(*args, **kwds)
            finally:
                self.disable_by_count()
            return result
        f.__name__ = func.__name__
        f.__doc__ = func.__doc__
        f.__dict__.update(func.__dict__)
        return f

    def __enter__(self):
        self.enable_by_count()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disable_by_count()

# avoid having to remove all @profile decorators if you want to do
# a quick change to call profiling
def profile_wrapper(func):
    from decorator import decorator
    def wrap(_f, *args, **kwds):
        if _profiler:
            if not hasattr(_f, '_prof_wrapped'):
                f = _profiler(_f)
                f._prof_wrapped = True
            return f(*args, **kwds)
        return _f(*args, **kwds)
    return decorator(wrap, func)

import __builtin__
__builtin__.__dict__['_profiler'] = None
__builtin__.__dict__['profile'] = profile_wrapper

class ProfilerMiddleware():
    """WSGI Middleware which profiles the subsequent handlers and outputs cachegrind files.
    
    in development.ini:
    
    [filter:profiler]
    enabled 0|1
    # type = line or call
    type = call|line
    # not used with line profiler, sort var is from cProfile
    sort = time
    # run a contextual profile
    builtin = 0|1
    # dump to stderr
    pprint = 0|1
    # convert to cachegrind (not used with line profiler)
    grind = 0|1
    # where to save profile data
    dir /some/predetermined/path
    
    Be sure apache has permission to write to profile_dir.
    
    Repeated runs will produce new profile output, remember to clean out
    the profile directoy on occasion.

    based on code from kernprof.py
    can use lsprofcalltree.py to convert profile data to kcachgrind format
    line profiling requires line_profiler: easy_install line_profiler
    """
        
    def __init__(self, app, g_config, config):
        self.app = app
        self.profile_type = config.get('type', 'call')
        self.profile_print = bool(int(config.get('pprint','0')))
        self.profile_sort = config.get('sort', 'time')
        self.profile_grind = bool(int(config.get('grind','0')))
        self.profile_builtin = bool(int(config.get('builtin','0')))
        self.profile_data_dir = config.get('dir', None)

    def __call__(self, environ, start_response):
        """ 
        Profile this request and output results in a cachegrind compatible format.
        """
        catch_response = []
        body = []
        def replace_start_response(status, headers, exc_info=None):
            catch_response.extend([status, headers])
            start_response(status, headers, exc_info)
            return body.append
        def run_app():
            app_iter = self.app(environ, replace_start_response)
            try:
                body.extend(app_iter)
            finally:
                if hasattr(app_iter, 'close'):
                    app_iter.close()

        import __builtin__
        try:
            import lsprofcalltree
            calltree_enabled = True
        except ImportError:
            calltree_enabled = False
            
        import sys, os, time

        pstat_fn = None
        cg_fn = None
        
        calltree_enabled = calltree_enabled and self.profile_grind

        if self.profile_data_dir:
            # XXX fixme, this should end up in a better location
            if not os.path.exists(self.profile_data_dir):
                os.mkdir(self.profile_data_dir)
            count = 1 
            path = environ.get('PATH_INFO', '/tmp')
            if path == '/':
                path = 'root'
            path = path.strip("/").replace("/", "_")
            pid = os.getpid()
            t = time.time()
            pstat_fn = os.path.join(self.profile_data_dir,"prof.out.%s.%d.%d" % (path, pid, t))
            if calltree_enabled:
                cg_fn = os.path.join(self.profile_data_dir,"cachegrind.out.%s.%d.%d" % (path, pid, t))

        if self.profile_type == 'line':
            import line_profiler
            p = prof = line_profiler.LineProfiler()
            # line profiler aparently needs to be a builtin
            self.profile_builtin = True
            # line profiler has no get_stat, so converting to cachegrind
            # will not work
            calltree_enabled = False
        else:
            p = prof = ContextualProfile()

        if self.profile_builtin:
            __builtin__.__dict__['_profiler'] = p

        if self.profile_type == 'line':
            # reset the profile for the next run
            for k in p.code_map.keys():
                p.code_map[k] = {}

        try:
            if self.profile_builtin:
                run_app()                
            else:
                p.runctx('run_app()', globals(), locals())

        finally:
            if self.profile_print:
                if self.profile_type == 'line':
                    # line profiler doesn't support sort
                    p.print_stats()
                else:
                    p.print_stats(sort=self.profile_sort)

            if pstat_fn:
                print >> sys.stderr, "writing profile data to %s" % pstat_fn
                p.dump_stats(pstat_fn)

            if calltree_enabled:
                print >> sys.stderr, "writing cachegrind output to %s" % cg_fn
                k = lsprofcalltree.KCacheGrind(p)
                data = open(cg_fn, 'w+')
                k.output(data)
                data.close()
        return body

def make_profile_middleware(app, global_conf, **kw):
    """
    Wrap the application in a component that will profile each
    request.  
    """
    return ProfilerMiddleware(app, global_conf, kw)

class DBGPMiddleware():
    """WSGI Middleware which loads the PyDBGP debugger.
    
    in development.ini:
    
    [DEFAULT]
    idekey         character key for use with dbgp proxy
    host           machine client debugger (e.g. Komodo IDE) or proxy runs on
    port           port the client debugger or proxy listens on
    breakonexcept  only start debugging when an uncaught exception occurs
    """
        
    def __init__(self, app, config, idekey='', host='127.0.0.1', port='9000',
                 breakonexcept='0'):
        self.app = app
        self.config = config

        self.idekey = idekey
        self.host = host
        self.port = int(port)
        self.brk = bool(int(breakonexcept))

    def __call__(self, environ, start_response):
        """ 
        Debug this request.
        """ 
        from dbgp import client
        if self.brk:
            # breaks on uncaught exceptions
            client.brkOnExcept(self.host, self.port, self.idekey)
        else:
            # breaks on the next executed line
            client.brk(self.host, self.port, self.idekey)

            # we might want to do this, but you end up in some random middleware
            # and it's not the best experience.  Instead, break here, go
            # set some breakpoints where you want to debug, the continue

            #c = client.backendCmd(self.idekey)
            #c.stdin_enabled = 0
            #c.connect(self.host, self.port, 'application', [__file__])
            #
            ## despite it's name, this is how to run a function, it does not
            ## start a thread
            #return c.runThread(self.app, (environ, start_response), {})

        # run the app now, if you've stopped here in a debugger, I suggest
        # you go set some breakpoints and continue to those.
        return self.app(environ, start_response)


def make_dbgp_middleware(app, global_conf, idekey='', host='127.0.0.1', port='9000',
                 breakonexcept='0'):
    """
    Wrap the application in a component that will connect to a dbgp server
    for each request
    """
    return DBGPMiddleware(app, global_conf, idekey, host, port, breakonexcept)

