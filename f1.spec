%define __python /usr/bin/python

%{!?python_sitearch: %define python_sitearch %(%{__python} -c "from distutils.sysconfig import get_python_lib; print get_python_lib(1)")}
%{!?python_sitelib: %global python_sitelib %(%{__python} -c "from distutils.sysconfig import get_python_lib; print(get_python_lib())")}

%define name python-mozilla-f1

Name:           %{name} 
Version:        0.3.2dev
Release:        1%{?dist}
Summary:        Share Links Fast.

Group:          Applications/Internet
License:        MPL
URL:            http://f1.mozillamessaging.com/
Source0:        dist/linkdrop-%{version}.tar.gz
BuildArch:	    noarch
BuildRoot:      %{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

BuildRequires:  python-devel python-setuptools

#XXX More are needed
BuildRequires:  python-paste-deploy, python-paste-script
#Requires:

%description
F1 is a browser extension that allows you to share links
in a fast and fun way. Share links from within the browser,
from any webpage, using the same services you already know
and love. F1 is made by Mozilla Messaging. 

%prep
%setup -q -n linkdrop-%{version}

%build
CFLAGS="%{optflags}" %{__python} -c 'import setuptools; execfile("setup.py")' build

%install
rm -rf %{buildroot}
%{__python} -c 'import setuptools; execfile("setup.py")' install --skip-build --root %{buildroot}

%clean
rm -rf %{buildroot}

%files
%defattr(-,root,root,-)
%doc README.md LICENSE PKG-INFO docs/
%{python_sitelib}/*

%changelog
* Fri Mar 18 2011 Philippe M. Chiasson <gozer@mozillamessaging.com> - 0.3.2dev-1
- Initial spec file
