// Pulso · shell nativo de macOS
//
// Ventana con un WKWebView que carga la interfaz (Resources/web) y un
// puente `window.webkit.messageHandlers.pulso` con estas operaciones:
//   fetch          red sin restricciones de CORS (Meta, Claude, auditor SEO)
//   readData       lee pulso-data.json de la carpeta de datos
//   writeData      lo escribe solo si nadie lo cambió desde la última lectura
//   chooseFolder   elige la carpeta de datos (ej. una carpeta compartida de iCloud Drive)
//   dataLocation   ruta actual del archivo
//   secretGet/Set  llaves en el Llavero (Keychain) de esta Mac
//   prefGet/Set    preferencias locales (UserDefaults)
//   open           abre un enlace en el navegador
//   saveFile       guarda un archivo con el panel de macOS
//
// Se compila con ./build-app.sh (solo necesita las Command Line Tools de Xcode).

import Cocoa
import WebKit
import Security

enum Keychain {
    static let service = "app.pulso.metricas"

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func set(_ key: String, _ value: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(base as CFDictionary)
        guard !value.isEmpty, let data = value.data(using: .utf8) else { return }
        var add = base
        add[kSecValueData as String] = data
        SecItemAdd(add as CFDictionary, nil)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    let defaults = UserDefaults.standard
    let fm = FileManager.default

    // MARK: Ciclo de vida

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()

        let config = WKWebViewConfiguration()
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "pulso")
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        if #available(macOS 13.3, *) { webView.isInspectable = true }

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1320, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "Pulso"
        window.minSize = NSSize(width: 900, height: 600)
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("PulsoVentanaPrincipal")
        window.makeKeyAndOrderFront(nil)

        let web = Bundle.main.resourceURL!.appendingPathComponent("web")
        webView.loadFileURL(web.appendingPathComponent("index.html"), allowingReadAccessTo: web)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    // MARK: Menú (sin él no funcionan ⌘C / ⌘V dentro de la web)

    func buildMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Acerca de Pulso", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Ocultar Pulso", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Salir de Pulso", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)

        let editItem = NSMenuItem()
        let edit = NSMenu(title: "Edición")
        edit.addItem(withTitle: "Deshacer", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Rehacer", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cortar", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copiar", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Pegar", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Seleccionar todo", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        main.addItem(editItem)

        let viewItem = NSMenuItem()
        let view = NSMenu(title: "Visualización")
        let reload = NSMenuItem(title: "Recargar", action: #selector(reloadPage(_:)), keyEquivalent: "r")
        reload.target = self
        view.addItem(reload)
        view.addItem(withTitle: "Pantalla completa", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
            .keyEquivalentModifierMask = [.command, .control]
        viewItem.submenu = view
        main.addItem(viewItem)

        let winItem = NSMenuItem()
        let win = NSMenu(title: "Ventana")
        win.addItem(withTitle: "Minimizar", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        win.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        winItem.submenu = win
        main.addItem(winItem)
        NSApp.windowsMenu = win

        NSApp.mainMenu = main
    }

    @objc func reloadPage(_ sender: Any?) { webView.reload() }

    // MARK: Archivo de datos

    var dataFolder: URL {
        if let custom = defaults.string(forKey: "dataFolder") { return URL(fileURLWithPath: custom, isDirectory: true) }
        let base = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Pulso", isDirectory: true)
        try? fm.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }
    var dataURL: URL { dataFolder.appendingPathComponent("pulso-data.json") }

    /// Fecha de modificación en milisegundos (0 si no existe)
    func mtime(_ url: URL) -> Double {
        guard let attrs = try? fm.attributesOfItem(atPath: url.path), let date = attrs[.modificationDate] as? Date else { return 0 }
        return (date.timeIntervalSince1970 * 1000).rounded()
    }

    func readData() -> [String: Any] {
        let url = dataURL
        let text = try? String(contentsOf: url, encoding: .utf8)
        return ["text": text.map { $0 as Any } ?? NSNull(), "mtime": text == nil ? 0 : mtime(url), "path": url.path]
    }

    func writeData(_ body: [String: Any]) -> [String: Any] {
        guard let text = body["text"] as? String else { return ["ok": false, "error": "sin contenido"] }
        let url = dataURL
        let expected = (body["expectedMtime"] as? NSNumber)?.doubleValue ?? 0
        let current = mtime(url)
        // Alguien más (la otra Mac) guardó después de nuestra última lectura
        if current != 0 && abs(current - expected) > 1 {
            let other = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
            return ["ok": false, "conflict": true, "text": other, "mtime": current]
        }
        do {
            try fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try text.write(to: url, atomically: true, encoding: .utf8)
            return ["ok": true, "mtime": mtime(url)]
        } catch {
            return ["ok": false, "error": error.localizedDescription]
        }
    }

    func chooseFolder(_ reply: @escaping (Any?, String?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.prompt = "Usar esta carpeta"
        panel.message = "Elige dónde guardar pulso-data.json. Usa una carpeta compartida de iCloud Drive para que los dos vean lo mismo."
        panel.beginSheetModal(for: window) { [self] response in
            guard response == .OK, let folder = panel.url else { reply(["cancelled": true], nil); return }
            let old = dataURL
            let new = folder.appendingPathComponent("pulso-data.json")
            // Si la carpeta nueva está vacía, se lleva los datos actuales
            if !fm.fileExists(atPath: new.path), fm.fileExists(atPath: old.path) {
                try? fm.copyItem(at: old, to: new)
            }
            defaults.set(folder.path, forKey: "dataFolder")
            reply(["path": new.path], nil)
        }
    }

    // MARK: Red

    func doFetch(_ body: [String: Any], _ reply: @escaping (Any?, String?) -> Void) {
        guard let s = body["url"] as? String, let url = URL(string: s) else { reply(["error": "URL inválida"], nil); return }
        var req = URLRequest(url: url, timeoutInterval: 600)
        req.httpMethod = (body["method"] as? String) ?? "GET"
        if let headers = body["headers"] as? [String: Any] {
            for (k, v) in headers { req.setValue("\(v)", forHTTPHeaderField: k) }
        }
        if let payload = body["body"] as? String { req.httpBody = payload.data(using: .utf8) }
        let started = Date()
        URLSession.shared.dataTask(with: req) { data, response, error in
            DispatchQueue.main.async {
                if let error = error { reply(["error": error.localizedDescription], nil); return }
                let http = response as? HTTPURLResponse
                var headers: [String: String] = [:]
                http?.allHeaderFields.forEach { k, v in headers["\(k)".lowercased()] = "\(v)" }
                var text = ""
                if let d = data { text = String(data: d, encoding: .utf8) ?? String(data: d, encoding: .isoLatin1) ?? "" }
                reply([
                    "status": http?.statusCode ?? 0,
                    "body": text,
                    "headers": headers,
                    "url": http?.url?.absoluteString ?? s,
                    "ms": Int(Date().timeIntervalSince(started) * 1000),
                ], nil)
            }
        }.resume()
    }

    // MARK: Puente JS ↔ Swift

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let op = body["op"] as? String else {
            replyHandler(nil, "mensaje inválido"); return
        }
        let key = body["key"] as? String ?? ""
        switch op {
        case "fetch": doFetch(body, replyHandler)
        case "readData": replyHandler(readData(), nil)
        case "writeData": replyHandler(writeData(body), nil)
        case "dataLocation": replyHandler(["path": dataURL.path], nil)
        case "chooseFolder": chooseFolder(replyHandler)
        case "secretGet": replyHandler(["value": Keychain.get(key) ?? ""], nil)
        case "secretSet":
            Keychain.set(key, body["value"] as? String ?? "")
            replyHandler(["ok": true], nil)
        case "prefGet": replyHandler(["value": defaults.string(forKey: "pref." + key).map { $0 as Any } ?? NSNull()], nil)
        case "prefSet":
            defaults.set(body["value"] as? String ?? "", forKey: "pref." + key)
            replyHandler(["ok": true], nil)
        case "open":
            if let s = body["url"] as? String, let url = URL(string: s) { NSWorkspace.shared.open(url) }
            replyHandler(["ok": true], nil)
        case "copy":
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(body["text"] as? String ?? "", forType: .string)
            replyHandler(["ok": true], nil)
        case "claudeCodePath":
            runShell("command -v claude || ls ~/.local/bin/claude ~/.claude/local/claude /opt/homebrew/bin/claude /usr/local/bin/claude 2>/dev/null | head -1", input: nil) { code, out, _ in
                let path = out.trimmingCharacters(in: .whitespacesAndNewlines)
                replyHandler(["path": code == 0 && !path.isEmpty ? path : ""], nil)
            }
        case "claudeCode":
            // Corre `claude -p` (Claude Code) con la sesión de la suscripción del usuario.
            // El prompt entra por stdin; se ejecuta en una carpeta temporal vacía.
            let path = body["path"] as? String ?? "claude"
            let quoted = "'" + path.replacingOccurrences(of: "'", with: "'\\''") + "'"
            runShell("\(quoted) -p --output-format text", input: body["prompt"] as? String ?? "") { code, out, err in
                replyHandler(["ok": code == 0, "text": out, "error": err, "code": code], nil)
            }
        case "saveFile":
            let panel = NSSavePanel()
            panel.nameFieldStringValue = body["name"] as? String ?? "pulso.json"
            panel.beginSheetModal(for: window) { response in
                guard response == .OK, let url = panel.url else { replyHandler(["ok": false], nil); return }
                do {
                    try (body["text"] as? String ?? "").write(to: url, atomically: true, encoding: .utf8)
                    replyHandler(["ok": true], nil)
                } catch {
                    replyHandler(["ok": false, "error": error.localizedDescription], nil)
                }
            }
        default: replyHandler(nil, "operación desconocida: \(op)")
        }
    }

    /// Ejecuta un comando en una shell de inicio de sesión (zsh -l) para tener
    /// el mismo PATH que la Terminal, y devuelve código, salida y errores.
    func runShell(_ command: String, input: String?, _ done: @escaping (Int32, String, String) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/bin/zsh")
            p.arguments = ["-lc", command]
            p.currentDirectoryURL = FileManager.default.temporaryDirectory
            let outPipe = Pipe(), errPipe = Pipe(), inPipe = Pipe()
            p.standardOutput = outPipe
            p.standardError = errPipe
            p.standardInput = inPipe
            var outData = Data(), errData = Data()
            let group = DispatchGroup()
            group.enter(); group.enter()
            DispatchQueue.global().async { outData = outPipe.fileHandleForReading.readDataToEndOfFile(); group.leave() }
            DispatchQueue.global().async { errData = errPipe.fileHandleForReading.readDataToEndOfFile(); group.leave() }
            do {
                try p.run()
                if let input = input, let d = input.data(using: .utf8) { inPipe.fileHandleForWriting.write(d) }
                try? inPipe.fileHandleForWriting.close()
                p.waitUntilExit()
                group.wait()
            } catch {
                DispatchQueue.main.async { done(-1, "", error.localizedDescription) }
                return
            }
            let out = String(data: outData, encoding: .utf8) ?? ""
            let err = String(data: errData, encoding: .utf8) ?? ""
            let code = p.terminationStatus
            DispatchQueue.main.async { done(code, out, err) }
        }
    }

    // MARK: Navegación y diálogos de la web

    // Los enlaces externos se abren en el navegador, no dentro de la app
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, url.scheme != "file", url.scheme != "about" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "Aceptar")
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "Aceptar")
        alert.addButton(withTitle: "Cancelar")
        alert.beginSheetModal(for: window) { response in completionHandler(response == .alertFirstButtonReturn) }
    }

    // <input type="file"> (importar CSV y respaldos)
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
