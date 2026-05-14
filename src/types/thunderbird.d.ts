import type { Browser } from "#imports"

declare global {
  interface ThunderbirdMessageHeader {
    id: number
    subject?: string
    author?: string
  }

  interface ThunderbirdTab extends Browser.tabs.Tab {
    type?: "addressBook" | "calendar" | "calendarEvent" | "calendarTask" | "chat" | "content" | "mail" | "messageCompose" | "messageDisplay" | "special" | "tasks"
  }

  interface ThunderbirdMenuClickData {
    menuItemId: string | number
    selectionText?: string
    frameId?: number
  }

  interface ThunderbirdMessageDisplayApi {
    getDisplayedMessages: (tabId?: number) => Promise<ThunderbirdMessageHeader[]>
    onMessagesDisplayed?: {
      addListener: (listener: (tab: ThunderbirdTab, displayedMessages: ThunderbirdMessageHeader[]) => void) => void
    }
  }

  interface ThunderbirdMessageDisplayActionApi {
    setTitle?: (details: { tabId?: number, title: string | null }) => Promise<void>
    enable?: (tabId?: number) => Promise<void>
    disable?: (tabId?: number) => Promise<void>
  }

  interface ThunderbirdScriptingMessageDisplayApi {
    registerScripts: (scripts: Array<{
      id: string
      js?: string[]
      css?: string[]
      runAt?: "document_start" | "document_end" | "document_idle"
    }>) => Promise<void>
    unregisterScripts: (filter?: { ids?: string[] }) => Promise<void>
  }

  interface ThunderbirdMenusApi {
    create: (createProperties: {
      id: string
      title: string
      contexts: string[]
    }) => string | number
    removeAll: () => Promise<void> | void
    onClicked: {
      addListener: (listener: (info: ThunderbirdMenuClickData, tab?: ThunderbirdTab) => void) => void
    }
  }

  interface ThunderbirdScriptingApi {
    executeScript?: Browser.scripting.Static["executeScript"]
    insertCSS?: Browser.scripting.Static["insertCSS"]
    removeCSS?: Browser.scripting.Static["removeCSS"]
    messageDisplay: ThunderbirdScriptingMessageDisplayApi
  }

  interface ThunderbirdMessengerApi {
    runtime: Browser.runtime.Static
    tabs: Browser.tabs.Static
    storage: Browser.storage.Static
    messageDisplay: ThunderbirdMessageDisplayApi
    messageDisplayAction?: ThunderbirdMessageDisplayActionApi
    menus: ThunderbirdMenusApi
    scripting: ThunderbirdScriptingApi
  }

  // eslint-disable-next-line vars-on-top
  var messenger: ThunderbirdMessengerApi | undefined
}

export {}
