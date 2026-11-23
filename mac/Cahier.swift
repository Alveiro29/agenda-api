// Cahier para Mac: una ventana nativa (WKWebView) que carga Cahier.html desde el bundle.
// La compila scripts/instalar-cahier.sh en la Mac del usuario con `swiftc`.
import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate {
    var window: NSWindow!
    var web: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()
        web = WKWebView(frame: .zero, configuration: config)
        web.uiDelegate = self

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 560, height: 880),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "Cahier"
        window.minSize = NSSize(width: 360, height: 520)
        window.center()
        window.setFrameAutosaveName("CahierVentana")
        window.contentView = web
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(web)

        if let url = Bundle.main.url(forResource: "Cahier", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    // alert() y confirm() de la página
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert()
        a.messageText = message
        a.addButton(withTitle: "Aceptar")
        a.runModal()
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert()
        a.messageText = message
        a.addButton(withTitle: "Aceptar")
        a.addButton(withTitle: "Cancelar")
        completionHandler(a.runModal() == .alertFirstButtonReturn)
    }

    @objc func recargar(_ sender: Any?) { web.reload() }
}

func construirMenu(_ delegate: AppDelegate) -> NSMenu {
    let barra = NSMenu()

    let appItem = NSMenuItem()
    barra.addItem(appItem)
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "Ocultar Cahier", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    appMenu.addItem(NSMenuItem.separator())
    appMenu.addItem(withTitle: "Salir de Cahier", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu

    let editItem = NSMenuItem()
    barra.addItem(editItem)
    let edit = NSMenu(title: "Edición")
    edit.addItem(withTitle: "Deshacer", action: Selector(("undo:")), keyEquivalent: "z")
    edit.addItem(withTitle: "Rehacer", action: Selector(("redo:")), keyEquivalent: "Z")
    edit.addItem(NSMenuItem.separator())
    edit.addItem(withTitle: "Cortar", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    edit.addItem(withTitle: "Copiar", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    edit.addItem(withTitle: "Pegar", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    edit.addItem(withTitle: "Seleccionar todo", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = edit

    let verItem = NSMenuItem()
    barra.addItem(verItem)
    let ver = NSMenu(title: "Ver")
    let recargar = NSMenuItem(title: "Recargar", action: #selector(AppDelegate.recargar(_:)), keyEquivalent: "r")
    recargar.target = delegate
    ver.addItem(recargar)
    verItem.submenu = ver

    let winItem = NSMenuItem()
    barra.addItem(winItem)
    let win = NSMenu(title: "Ventana")
    win.addItem(withTitle: "Minimizar", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    win.addItem(withTitle: "Cerrar", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
    winItem.submenu = win
    return barra
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.mainMenu = construirMenu(delegate)
app.run()
