// ==UserScript==
// @name			Echelon :: Layout
// @description 	Manages Echelon custom layout stuff.
// @author			ephemeralViolette
// @include			main
// ==/UserScript==

let g_echelonLayoutManager;
	
{
	class LayoutManager
	{
		urlbarEl = null;
		lang = Services.locale.requestedLocale;
		
		async init()
		{
			this.initTabsOnTop();
			
			let toolboxRoot = await waitForElement("#navigator-toolbox");
			toolboxRoot.addEventListener("customizationchange", this);
			toolboxRoot.addEventListener("aftercustomization", this);
			this.refreshToolboxLayout();
		}
		
		initTabsOnTop()
		{
			try
			{
				this._applyTabsOnTopFromPrefs();
			}
			catch (e)
			{
				if (e.name == "NS_ERROR_UNEXPECTED") // preference does not exist
				{
					try
					{
						PrefUtils.trySetBoolPref("Echelon.Appearance.TabsOnTop", true);
					}
					catch (e) {}
				}
			}
			
			Services.prefs.addObserver("Echelon.Appearance.TabsOnTop", this._applyTabsOnTopFromPrefs.bind(this));
		}
		
		setTabsOnTop(state)
		{
			PrefUtils.trySetBoolPref("Echelon.Appearance.TabsOnTop", state);
			this._applyTabsOnTopState(state);
		}
		
		_applyTabsOnTopFromPrefs()
		{
			let newState = Services.prefs.getBoolPref("Echelon.Appearance.TabsOnTop");
			this._applyTabsOnTopState(newState);
		}
		
		/**
		 * Applies the user's tabs on top preference.
		 *
		 * If the tabs are on top, then they are static and their layout cannot be changed. If they are
		 * not on top, then tabs are a flexible toolbar via CustomizeUI.
		 */
		_applyTabsOnTopState(state)
		{
			/* Tabs on bottom is not supported on Australis. */
			let style = PrefUtils.tryGetIntPref("Echelon.Appearance.Style");
			if (style < ECHELON_LAYOUT_AUSTRALIS || state)
			{
				let tabsContainer = document.querySelector("#TabsToolbar");
				
				if (!tabsContainer)
				{
					console.log("???", document);
					return;
				}
				
				if (state == true)
				{
					document.querySelector("#titlebar").appendChild(tabsContainer);
					document.documentElement.setAttribute("tabs-on-top", "true");
				}
				else
				{
					document.querySelector("#PersonalToolbar").insertAdjacentElement("afterend", tabsContainer);
					document.documentElement.removeAttribute("tabs-on-top");
				}
				
				// In lieu of an actual global messaging system, we will just message directly to modules that need it:
				// (this should be cleaned up in the future)
				if (g_echelonFirefoxButton)
				{
					g_echelonFirefoxButton.onUpdateTabsOnTop(state);
				}
			}

			let menuitem = document.getElementById("toolbar-context-echelonTabsOnTop");
			if (menuitem)
			{
				if (state == true)
				{
					menuitem.setAttribute("checked", "true");
				}
				else
				{
					menuitem.removeAttribute("checked");
				}
			}
		}
		
		refreshToolboxLayout()
		{
			// Update reload button
			let reloadButtonEl;
			if (reloadButtonEl = document.querySelector("#stop-reload-button"))
			{
				// We need to figure out what the previous element is as well:
				let previousEl = null;
				
				if (reloadButtonEl.parentNode?.nodeName == "toolbarpaletteitem")
				{
					// Customise mode is active, so we need to hack around to resolve
					// the non-wrapped previous element.
					previousEl = reloadButtonEl.parentNode.previousSibling?.children[0];
				}
				else
				{
					previousEl = reloadButtonEl.previousSibling;
				}
				
				if (previousEl?.id == "urlbar-container")
				{
					previousEl.classList.add("unified-refresh-button");
					reloadButtonEl.classList.add("unified");
					Array.from(reloadButtonEl.children).forEach(elm => elm.classList.add("unified"));
					
					this.urlbarEl = previousEl;
				}
				else
				{
					// Previous element is not guaranteed to exist.
					this.urlbarEl?.classList.remove("unified-refresh-button");
					
					reloadButtonEl.classList.remove("unified");
					Array.from(reloadButtonEl.children).forEach(elm => elm.classList.remove("unified"));
				}
			}
		}
		
		handleEvent(event)
		{
			switch (event.type)
			{
				case "aftercustomization":
				case "customizationchange":
					this.refreshToolboxLayout();
					break;
			}
		}

		onCustomizePopupShowing()
		{
			if (this.lang != Services.locale.requestedLocale)
			{
				this.lang = Services.locale.requestedLocale;
				strings = Services.strings.createBundle("chrome://echelon/locale/properties/menus.properties");
				let tabsOnTopItem = document.getElementById("toolbar-context-echelonTabsOnTop");
				if (tabsOnTopItem)
				{
					tabsOnTopItem.label = strings.GetStringFromName("tabs_on_top_label");
					tabsOnTopItem.accessKey = strings.GetStringFromName("tabs_on_top_accesskey");
				}
			}
		}
	}
	
	g_echelonLayoutManager = new LayoutManager;
	g_echelonLayoutManager.init();

	let strings = Services.strings.createBundle("chrome://echelon/locale/properties/menus.properties");
	
	waitForElement("#toolbar-context-menu").then((prefsItem) => {
		let echelonTabsOnTopItem = window.MozXULElement.parseXULToFragment(`
			<menuitem id="toolbar-context-echelonTabsOnTop"
						oncommand="g_echelonLayoutManager.setTabsOnTop(Boolean(this.getAttribute('checked')))"
						type="checkbox"
						label="${strings.GetStringFromName("tabs_on_top_label")}" 
						accesskey="${strings.GetStringFromName("tabs_on_top_accesskey")}"/>
			<menuseparator xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" id="tabsOnTopMenuSeparator"/>
		`);

		waitForElement("#toolbar-context-echelonOptions").then(e => {
			prefsItem.insertBefore(echelonTabsOnTopItem, e);

			let isTabsOnTop = PrefUtils.tryGetBoolPref("Echelon.Appearance.TabsOnTop");
			let contextMenuItem = document.querySelector("#toolbar-context-echelonTabsOnTop");
			if (contextMenuItem)
			{
				if (isTabsOnTop == true)
				{
					contextMenuItem.setAttribute("checked", "true");
				}
				else
				{
					contextMenuItem.removeAttribute("checked");
				}
			}
			contextMenuItem.parentNode.addEventListener("popupshowing", g_echelonLayoutManager.onCustomizePopupShowing);
		});
	});
}
