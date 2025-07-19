import { callable, findModule, Millennium, sleep } from "@steambrew/client";

// Backend functions
const get_app_x = callable<[{ app_id: number }], number>('Backend.get_app_x');
const get_app_y = callable<[{ app_id: number }], number>('Backend.get_app_y');
const set_app_xy = callable<[{ app_id: number, pos_x: number, pos_y: number }], boolean>('Backend.set_app_xy');

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

const WaitForElementTimeout = async (sel: string, parent = document, timeOut = 1000) =>
	[...(await Millennium.findElement(parent, sel, timeOut))][0];

const WaitForElementList = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))];

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
                const sizerDiv = await WaitForElement(`div.${findModule(e => e.BoxSizer).BoxSizer}`, popup.m_popup.document);

                const savedX = await get_app_x({ app_id: uiStore.currentGameListSelection.nAppId });
                const savedY = await get_app_y({ app_id: uiStore.currentGameListSelection.nAppId });
                if (savedX !== -1 || savedY !== -1) {
                    sizerDiv.style.left = savedX + "px";
                    sizerDiv.style.top = savedY + "px";
                }

                const gameSettingsButton = await WaitForElement(`div.${findModule(e => e.InPage).InPage} div.${findModule(e => e.AppButtonsContainer).AppButtonsContainer} > div.${findModule(e => e.MenuButtonContainer).MenuButtonContainer}:not([role="button"])`, popup.m_popup.document);
                const oldMoveButton = gameSettingsButton.parentNode.querySelector('div.logo-move-button');
                if (!oldMoveButton) {
                    const moveButton = gameSettingsButton.cloneNode(true);
                    moveButton.classList.add("logo-move-button");
                    moveButton.firstChild.innerHTML = "ML";
                    gameSettingsButton.parentNode.insertBefore(moveButton, gameSettingsButton.nextSibling);

                    moveButton.addEventListener("click", async () => {
                        if (!sizerDiv.classList.contains("logopos-header")) {
                            async function makeDraggableElement(elmnt) {
                                var diffX = 0, diffY = 0, lastX = 0, lastY = 0, elmntX = 0, elmntY = 0;
                                elmnt.onmousedown = dragMouseDown;
                                elmnt.style.cursor = "move";

                                async function dragMouseDown(e) {
                                    e = e || window.event;
                                    e.preventDefault();

                                    lastX = e.clientX;
                                    lastY = e.clientY;

                                    popup.m_popup.document.onmouseup = elementRelease;
                                    popup.m_popup.document.onmousemove = elementDrag;
                                }

                                async function elementDrag(e) {
                                    e = e || window.event;
                                    e.preventDefault();

                                    diffX = lastX - e.clientX;
                                    diffY = lastY - e.clientY;
                                    lastX = e.clientX;
                                    lastY = e.clientY;

                                    elmntY = (elmnt.offsetTop - diffY);
                                    elmntX = (elmnt.offsetLeft - diffX);
                                    elmnt.style.top = elmntY + "px";
                                    elmnt.style.left = elmntX + "px";
                                }

                                async function elementRelease() {
                                    popup.m_popup.document.onmouseup = null;
                                    popup.m_popup.document.onmousemove = null;

                                    await set_app_xy({ app_id: uiStore.currentGameListSelection.nAppId, pos_x: elmntX, pos_y: elmntY });
                                }
                            }

                            makeDraggableElement(sizerDiv);
                            sizerDiv.classList.add("logopos-header");
                        } else {
                            sizerDiv.onmousedown = null;
                            sizerDiv.style.cursor = "";
                            sizerDiv.classList.remove("logopos-header");
                        }
                    });
                }
            }
        });
    }
}

export default async function PluginMain() {
    console.log("[steam-logo-pos] Frontend startup");
    await sleep(1000);  // Hopefully temporary workaround

    const doc = g_PopupManager.GetExistingPopup("SP Desktop_uid0");
	if (doc) {
		OnPopupCreation(doc);
	}

	g_PopupManager.AddPopupCreatedCallback(OnPopupCreation);
}
