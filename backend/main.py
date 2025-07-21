import Millennium, PluginUtils # type: ignore
logger = PluginUtils.Logger()

import json
import os

pos_db = {}

########
# UTIL #
########

def get_config_fname():
    return os.path.join(PLUGIN_BASE_DIR, "config.json")

def get_config():
    with open(get_config_fname(), "rt") as fp:
        return json.load(fp)

def get_db_fname():
    return os.path.join(PLUGIN_BASE_DIR, "pos-db.json")

def load_pos_db():
    global pos_db
    if os.path.exists(get_db_fname()):
        with open(get_db_fname(), "rt") as fp:
            pos_db = json.load(fp)

def save_pos_db():
    global pos_db
    with open(get_db_fname(), "wt") as fp:
        json.dump(pos_db, fp)

###########
# DB UTIL #
###########

def get_x_pos(app_id):
    global pos_db
    app_id_str = str(app_id)
    if app_id_str in pos_db:
        return pos_db[app_id_str][0]
    return -1

def get_y_pos(app_id):
    global pos_db
    app_id_str = str(app_id)
    if app_id_str in pos_db:
        return pos_db[app_id_str][1]
    return -1

def set_xy_pos(app_id, pos_x, pos_y):
    global pos_db
    app_id_str = str(app_id)
    pos_db[app_id_str] = [pos_x, pos_y]
    save_pos_db()

##############
# INTERFACES #
##############

class Backend:
    @staticmethod
    def get_app_x(app_id):
        pos_x = get_x_pos(app_id)
        logger.log(f"get_app_x({app_id}) -> {pos_x}")
        return pos_x

    @staticmethod
    def get_app_y(app_id):
        pos_y = get_y_pos(app_id)
        logger.log(f"get_app_y({app_id}) -> {pos_y}")
        return pos_y

    @staticmethod
    def set_app_xy(app_id, pos_x, pos_y):
        logger.log(f"set_app_xy({app_id}, {pos_x}, {pos_y})")
        set_xy_pos(app_id, pos_x, pos_y)
        return True

    @staticmethod
    def get_context_menu_enabled():
        context_menu_enabled = get_config()["context_menu"]
        logger.log(f"get_context_menu_enabled() -> {context_menu_enabled}")
        return context_menu_enabled

    @staticmethod
    def get_app_button_enabled():
        app_button_enabled = get_config()["show_button"]
        logger.log(f"get_app_button_enabled() -> {app_button_enabled}")
        return app_button_enabled

class Plugin:
    def _front_end_loaded(self):
        logger.log("Frontend loaded")

    def _load(self):
        logger.log(f"Plugin base dir: {PLUGIN_BASE_DIR}")

        load_pos_db()
        logger.log("Database loaded")

        logger.log("Backend loaded")
        Millennium.ready()

    def _unload(self):
        save_pos_db()
        logger.log("Database saved")
        logger.log("Unloading")
