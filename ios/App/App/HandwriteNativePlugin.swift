import Foundation
import UIKit
import Vision
import UniformTypeIdentifiers
import Capacitor

/// Native helpers for the web app:
/// - Apple Vision text recognition (printed text, board photos, handwriting)
/// - photos handed over by the share extension ("Teilen mit Handwrite Studio")
@objc(HandwriteNativePlugin)
public class HandwriteNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HandwriteNativePlugin"
    public let jsName = "HandwriteNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeSharedImages", returnType: CAPPluginReturnPromise),
    ]

    static let sharePasteboard = "com.handwritestudio.app.share"

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
