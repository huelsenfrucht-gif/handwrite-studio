import Foundation
import UIKit
import Vision
import UniformTypeIdentifiers
import Capacitor

/// Native helpers for the web app:
/// - Apple Vision text recognition (printed text, board photos, handwriting)
/// - photos handed over by the share extension ("Teilen mit Handwritten")
@objc(HandwriteNativePlugin)
public class HandwriteNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HandwriteNativePlugin"
    public let jsName = "HandwriteNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeDocument", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeSharedImages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "adContext", returnType: CAPPluginReturnPromise),
    ]

    static let sharePasteboard = "de.vonhuelsen.handwritten.share"

    // MARK: Ads

    /// Where this build comes from and what the user chose in Google's consent form.
    /// - distribution: "debug" (Xcode), "testflight" (sandbox receipt) or "appstore". Test builds must only
    ///   request Google's test ads, the App Store version real ones – decided here, so nobody can forget a switch.
    /// - storageConsent: TCF purpose 1 ("store/access information on a device"); nil outside the EU form.
    @objc func adContext(_ call: CAPPluginCall) {
        var distribution = "appstore"
        #if DEBUG
        distribution = "debug"
        #else
        if Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt" { distribution = "testflight" }
        #endif
        var result: [String: Any] = ["distribution": distribution]
        if let purposes = UserDefaults.standard.string(forKey: "IABTCF_PurposeConsents"), let first = purposes.first {
            result["storageConsent"] = first == "1"
        }
        call.resolve(result)
    }

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

    // MARK: Document structure (iOS 26): paragraphs, exact lines and tables

    /// Reads a photo of a board, a book page or a worksheet as a document: every printed line stays a line,
    /// tables come back as "| a | b |" rows, blocks are separated by an empty line. Not available → reject.
    @objc func recognizeDocument(_ call: CAPPluginCall) {
        guard let base64 = call.getString("image"), let data = Data(base64Encoded: base64), let image = UIImage(data: data), let cgImage = image.cgImage else {
            call.reject("Das Bild konnte nicht gelesen werden."); return
        }
        guard #available(iOS 26.0, *) else { call.reject("unavailable"); return }
        Task {
            do {
                var request = RecognizeDocumentsRequest()
                request.textRecognitionOptions.recognitionLanguages = [Locale.Language(identifier: "de-DE"), Locale.Language(identifier: "en-US")]
                request.textRecognitionOptions.useLanguageCorrection = true
                let observations = try await request.perform(on: cgImage)
                // Blocks in Vision's reading order with their position (top-left origin, normalised).
                var blocks: [[String: Any]] = []
                func rect(_ r: NormalizedRect) -> [String: Any] { ["x": r.origin.x, "y": 1 - r.origin.y - r.height, "width": r.width, "height": r.height] }
                for observation in observations {
                    let doc = observation.document
                    var tableBoxes: [CGRect] = []
                    for table in doc.tables {
                        let rows = table.rows.map { row in row.map { $0.content.text.transcript.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines) } }
                        let box = table.boundingRegion.boundingBox
                        tableBoxes.append(CGRect(x: box.origin.x, y: box.origin.y, width: box.width, height: box.height))
                        blocks.append(["kind": "table", "rows": rows].merging(rect(box)) { a, _ in a })
                    }
                    for paragraph in doc.paragraphs {
                        let box = paragraph.boundingRegion.boundingBox
                        let c = CGPoint(x: box.origin.x + box.width / 2, y: box.origin.y + box.height / 2)
                        if tableBoxes.contains(where: { $0.insetBy(dx: -0.005, dy: -0.005).contains(c) }) { continue }
                        let lines: [[String: Any]] = paragraph.lines.compactMap { line in
                            guard let t = line.topCandidates(1).first?.string, !t.isEmpty else { return nil }
                            return ["text": t].merging(rect(line.boundingBox)) { a, _ in a }
                        }
                        if lines.isEmpty { continue }
                        blocks.append(["kind": "text", "lines": lines].merging(rect(box)) { a, _ in a })
                    }
                }
                call.resolve(["blocks": blocks])
            } catch {
                call.reject("Dokumenterkennung fehlgeschlagen: \(error.localizedDescription)")
            }
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
        bridge?.registerPluginInstance(LectureRecorderPlugin())
    }
}
