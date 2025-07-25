import { callable, findModule, Millennium, sleep } from "@steambrew/client";

// Backend functions
const get_app_x = callable<[{ app_id: number }], number>('Backend.get_app_x');
const get_app_y = callable<[{ app_id: number }], number>('Backend.get_app_y');
const set_app_xy = callable<[{ app_id: number, pos_x: number, pos_y: number }], boolean>('Backend.set_app_xy');
const get_context_menu_enabled = callable<[{}], boolean>('Backend.get_context_menu_enabled');
const get_app_button_enabled = callable<[{}], boolean>('Backend.get_app_button_enabled');

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

const WaitForElementTimeout = async (sel: string, parent = document, timeOut = 1000) =>
	[...(await Millennium.findElement(parent, sel, timeOut))][0];

const WaitForElementList = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))];

async function OnPopupCreation(popup) {
    if (popup.m_strName === "SP Desktop_uid0") {
        
        let observer = null; // Declare observer here to hold its reference across navigations.

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

                const movementHandler = async () => {
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
                };

                const appButtonEnabled = await get_app_button_enabled({});
                if (appButtonEnabled) {
                    const gameSettingsButton = await WaitForElement(`div.${findModule(e => e.InPage).InPage} div.${findModule(e => e.AppButtonsContainer).AppButtonsContainer} > div.${findModule(e => e.MenuButtonContainer).MenuButtonContainer}:not([role="button"])`, popup.m_popup.document);
                    const oldMoveButton = gameSettingsButton.parentNode.querySelector('div.logo-move-button');
                    
                    if (!oldMoveButton) {
                        const moveButton = gameSettingsButton.cloneNode(true);
                        moveButton.classList.add("logo-move-button");
                        moveButton.firstChild.innerHTML = "ML";
                        gameSettingsButton.parentNode.insertBefore(moveButton, gameSettingsButton.nextSibling);
                        moveButton.addEventListener("click", movementHandler);
                    }
                }

                const contextMenuEnabled = await get_context_menu_enabled({});
                if (contextMenuEnabled) {

                    // Disconnect the old observer before creating a new one to prevent conflicts.
                    if (observer) {
                        observer.disconnect();
                    }

                    const hasSpecificMenuItems = (container) => {
                        const itemsText = Array.from(container.querySelectorAll('div._1n7Wloe5jZ6fSuvV18NNWI.contextMenuItem'))
                            .map(el => el.textContent.trim());
                        const requiredItems = ['Adjust Logo Position'];
                        return requiredItems.every(item => itemsText.includes(item));
                    };

                    const addMoveLogoButton = (container) => {
                        if (!hasSpecificMenuItems(container)) return;
                        if (container.querySelector('.contextMenuItem.moveLogoAdded')) return;

                        const newItem = document.createElement('div');
                        newItem.setAttribute('role', '_1n7Wloe5jZ6fSuvV18NNWI');
                        newItem.className = '_1n7Wloe5jZ6fSuvV18NNWI contextMenuItem moveLogoAdded';
                        newItem.textContent = 'Move Logo';
                        newItem.addEventListener('click', async () => {
                            await movementHandler();
                            const parentDiv = container.parentElement;
                            if (parentDiv) parentDiv.style.display = 'none';
                            else container.style.display = 'none';
                        });
                        container.appendChild(newItem);
                        console.log('[steam-logo-pos] "Move Logo" item successfully added');
                    };

                    // Assign to the shared observer reference.
                    observer = new MutationObserver(mutations => {
                        mutations.forEach(mutation => {
                            mutation.addedNodes.forEach(node => {
                                if (node.nodeType === 1) { // Element node
                                    const container = node.querySelector('div._2EstNjFIIZm_WUSKm5Wt7n') ||
                                        (node.classList && node.classList.contains('_2EstNjFIIZm_WUSKm5Wt7n') ? node : null);
                                    if (container) {
                                        addMoveLogoButton(container);
                                    }
                                }
                            });
                        });
                    });

                    observer.observe(popup.m_popup.document.body, { childList: true, subtree: true });
                    //observer.observe(popup.m_popup.document, { childList: true, subtree: true });

                    // Initial fallback in case menu is already present
                    //waitForElement('div.contextMenuContainer').then(addMoveLogoButton).catch(console.error);
                }
            }
        });
    }
}

export default async function PluginMain() {
    console.log("[steam-logo-pos] Frontend startup");
    while (
        typeof g_PopupManager === 'undefined' ||
        typeof MILLENNIUM_API === 'undefined' ||
        typeof MILLENNIUM_BACKEND_IPC === 'undefined' ||
        typeof MainWindowBrowserManager === 'undefined'
    ) {
        await sleep(100);
    }

    const doc = g_PopupManager.GetExistingPopup("SP Desktop_uid0");
	if (doc) {
		OnPopupCreation(doc);
	}

	g_PopupManager.AddPopupCreatedCallback(OnPopupCreation);
}
