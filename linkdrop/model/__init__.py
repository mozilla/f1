"""The application's model objects"""
from linkdrop.model.meta import Session, Base
from linkdrop.model.account import Account


def init_model(engine):
    """Call me before using any of the tables or classes in the model"""
    Session.configure(bind=engine)
    Base.metadata.create_all(bind=Session.bind)
