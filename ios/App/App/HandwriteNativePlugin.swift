import Foundation
import UIKit
import Vision
import UniformTypeIdentifiers
import Capacitor

/// Native helpers for the web app:
/// - Apple Vision text recognition (printed text, board photos, handwriting)
/// - automatic backup/sync into a folder the user picks in iCloud Drive
/// - photos handed over by the share extension ("Teilen mit Handwrite Studio")
@objc(HandwriteNativePlugin)
public class HandwriteNativePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "HandwriteNativePlugin"
    public let jsName = "HandwriteNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickSyncFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readSyncFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeSyncFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnectSync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeSharedImages", returnType: CAPPluginReturnPromise),
    ]

    static let sharePasteboard = "com.handwritestudio.app.share"
    private let bookmarkKey = "handwrite.syncFolderBookmark"
    private var pickerCall: CAPPluginCall?

    // MARK: Text recognition

    @objc func recognizeText(_ call: CAPPluginCall) {
        guard let base64 = call.getString("image"), let data = Data(base64Encoded: base64), let image = UIImage(data: data), let cgImage = image.cgImage else {
            call.reject("Das Bild konnte nicht gelesen werden."); return
        }
        let languages = call.getArray("languages", String.self) ?? ["de-DE", "en-US"]
        DispatchQueue.global(qos: .userInitiated).async {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.recognitionLanguages = languages
            let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
            do {
                try handler.perform([request])
                let lines: [[String: Any]] = (request.results ?? []).compactMap { observation in
                    guard let best = observation.topCandidates(1).first else { return nil }
                    let box = observation.boundingBox // normalised, origin bottom-left
                    return ["text": best.string, "confidence": best.confidence, "x": box.minX, "y": 1 - box.maxY, "width": box.width, "height": box.height]
                }
                call.resolve(["lines": lines])
            } catch {
                call.reject("Texterkennung fehlgeschlagen: \(error.localizedDescription)")
            }
        }
    }

    // MARK: iCloud Drive folder

    @objc func pickSyncFolder(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.pickerCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
            picker.delegate = self
            picker.allowsMultipleSelection = false
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickerCall, let url = urls.first else { return }
        pickerCall = nil
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let bookmark = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
            UserDefaults.standard.set(bookmark, forKey: bookmarkKey)
            call.resolve(["connected": true, "name": url.lastPathComponent, "iCloud": isICloud(url)])
        } catch {
            call.reject("Der Ordner konnte nicht gespeichert werden: \(error.localizedDescription)")
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickerCall?.reject("cancelled"); pickerCall = nil
    }

    private func isICloud(_ url: URL) -> Bool { (try? url.resourceValues(forKeys: [.isUbiquitousItemKey]).isUbiquitousItem) ?? url.path.contains("Mobile Documents") }

    private func folder() -> URL? {
        guard let bookmark = UserDefaults.standard.data(forKey: bookmarkKey) else { return nil }
        var stale = false
        guard let url = try? URL(resolvingBookmarkData: bookmark, options: [], relativeTo: nil, bookmarkDataIsStale: &stale) else { return nil }
        if stale, url.startAccessingSecurityScopedResource() {
            if let fresh = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) { UserDefaults.standard.set(fresh, forKey: bookmarkKey) }
            url.stopAccessingSecurityScopedResource()
        }
        return url
    }

    @objc func syncStatus(_ call: CAPPluginCall) {
        guard let url = folder() else { call.resolve(["connected": false]); return }
        call.resolve(["connected": true, "name": url.lastPathComponent, "iCloud": isICloud(url)])
    }

    @objc func disconnectSync(_ call: CAPPluginCall) {
        UserDefaults.standard.removeObject(forKey: bookmarkKey)
        call.resolve()
    }

    @objc func readSyncFile(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), !name.contains("/") else { call.reject("Ungültiger Dateiname."); return }
        guard let dir = folder() else { call.reject("Kein Sync-Ordner gewählt."); return }
        DispatchQueue.global(qos: .utility).async {
            let access = dir.startAccessingSecurityScopedResource()
            defer { if access { dir.stopAccessingSecurityScopedResource() } }
            let file = dir.appendingPathComponent(name)
            try? FileManager.default.startDownloadingUbiquitousItem(at: file)
            var coordinationError: NSError?, result: [String: Any] = ["data": NSNull()], readError: Error?
            NSFileCoordinator().coordinate(readingItemAt: file, options: [], error: &coordinationError) { url in
                guard FileManager.default.fileExists(atPath: url.path) else { return }
                do {
                    result["data"] = try String(contentsOf: url, encoding: .utf8)
                    if let modified = try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate { result["modified"] = ISO8601DateFormatter().string(from: modified) }
                } catch { readError = error }
            }
            if let error = coordinationError ?? readError as NSError? { call.reject("Sync-Datei nicht lesbar: \(error.localizedDescription)"); return }
            call.resolve(result)
        }
    }

    @objc func writeSyncFile(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), !name.contains("/"), let text = call.getString("data") else { call.reject("Ungültige Daten."); return }
        guard let dir = folder() else { call.reject("Kein Sync-Ordner gewählt."); return }
        DispatchQueue.global(qos: .utility).async {
            let access = dir.startAccessingSecurityScopedResource()
            defer { if access { dir.stopAccessingSecurityScopedResource() } }
            var coordinationError: NSError?, writeError: Error?
            NSFileCoordinator().coordinate(writingItemAt: dir.appendingPathComponent(name), options: .forReplacing, error: &coordinationError) { url in
                do { try text.write(to: url, atomically: true, encoding: .utf8) } catch { writeError = error }
            }
            if let error = coordinationError ?? writeError as NSError? { call.reject("Sync-Datei nicht schreibbar: \(error.localizedDescription)"); return }
            call.resolve()
        }
    }

    // MARK: Photos from the share extension

    @objc func takeSharedImages(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let board = UIPasteboard.general
            // Checking the marker type does not read the clipboard (no paste prompt);
            // only photos handed over by our share extension are taken.
            guard board.contains(pasteboardTypes: [HandwriteNativePlugin.sharePasteboard]) else { call.resolve(["images": []]); return }
            let images = board.items.compactMap { item -> String? in
                if let data = item[UTType.jpeg.identifier] as? Data { return data.base64EncodedString() }
                return (item[UTType.jpeg.identifier] as? UIImage)?.jpegData(compressionQuality: 0.88)?.base64EncodedString()
            }
            board.items = []
            call.resolve(["images": images])
        }
    }
}

/// Bridge view controller that registers the app's own plugin.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HandwriteNativePlugin())
    }
}
