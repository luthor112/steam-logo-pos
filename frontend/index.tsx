import { callable, findModule, Millennium } from "@steambrew/client";

// Backend functions
const get_app_x = callable<[{ app_id: number }], number>('Backend.get_app_x');
const get_app_y = callable<[{ app_id: number }], number>('Backend.get_app_y');
const set_app_xy = callable<[{ app_id: number, pos_x: number, pos_y: number }], boolean>('Backend.purge_cache');

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

const WaitForElementTimeout = async (sel: string, parent = document, timeOut = 1000) =>
	[...(await Millennium.findElement(parent, sel, timeOut))][0];

const WaitForElementList = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))];

async function sleep(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

async function OnPopupCreation(popup: any) {
    if (popup.m_strName === "SP Desktop_uid0") {
        var mwbm = undefined;
        while (!mwbm) {
            console.log("[steam-logo-pos] Waiting for MainWindowBrowserManager");
            try {
                mwbm = MainWindowBrowserManager;
            } catch {
                await sleep(100);
            }
        }

        MainWindowBrowserManager.m_browser.on("finished-request", async (currentURL, previousURL) => {
            if (MainWindowBrowserManager.m_lastLocation.pathname.startsWith("/library/app/")) {
                const topCapsuleDiv = await WaitForElement(`div.${findModule(e => e.BoxSizer).BoxSizer}`, popup.m_popup.document);
                if (!topCapsuleDiv.classList.contains("logopos-header")) {
                    // TODO
                    topCapsuleDiv.classList.add("logopos-header");
                }
            }
        });
    }
}

export default async function PluginMain() {
    console.log("[steam-logo-pos] Frontend startup");

    const doc = g_PopupManager.GetExistingPopup("SP Desktop_uid0");
	if (doc) {
		OnPopupCreation(doc);
	}

	g_PopupManager.AddPopupCreatedCallback(OnPopupCreation);
}
