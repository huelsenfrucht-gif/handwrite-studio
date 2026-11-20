import UIKit
import UniformTypeIdentifiers

/// "Teilen mit Handwritten": takes photos from the share sheet, hands them
/// to the app through a team-private pasteboard and opens the app, which then
/// shows them in "Foto in deine Handschrift".
class ShareViewController: UIViewController {
    static let marker = "de.vonhuelsen.handwritten.share"
    private let status = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        status.text = "Foto wird an Handwritten übergeben …"
        status.numberOfLines = 0
        status.textAlignment = .center
        status.font = .preferredFont(forTextStyle: .headline)
        status.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(status)
        NSLayoutConstraint.activate([
            status.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            status.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            status.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { await handOver() }
    }

    private func handOver() async {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
            .filter { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) }
        var images: [Data] = []
        for provider in providers.prefix(10) {
            if let data = await loadImage(provider) { images.append(data) }
        }
        guard !images.isEmpty else { finish("Kein Foto gefunden."); return }
        // Handed over through the clipboard with a private marker type. This needs no
        // App Group, so the app also builds with a free Apple account.
        UIPasteboard.general.items = images.enumerated().map { index, data in
            index == 0 ? [UTType.jpeg.identifier: data, ShareViewController.marker: "\(images.count)"] : [UTType.jpeg.identifier: data]
        }
        status.text = images.count == 1 ? "Foto übergeben ✓\nHandwritten öffnet sich." : "\(images.count) Fotos übergeben ✓\nHandwritten öffnet sich."
        if !openApp(URL(string: "handwritestudio://share")!) {
            status.text = "Foto übergeben ✓\nÖffne jetzt Handwritten – es wartet dort auf dich."
        }
        try? await Task.sleep(nanoseconds: 900_000_000)
        finish(nil)
    }

    /// Loads, orients and downsizes a shared image to a JPEG of at most 2400 px.
    private func loadImage(_ provider: NSItemProvider) async -> Data? {
        await withCheckedContinuation { continuation in
            provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { data, _ in
                guard let data, let image = UIImage(data: data) else { continuation.resume(returning: nil); return }
                let scale = min(1, 2400 / max(image.size.width, image.size.height))
                let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
                let format = UIGraphicsImageRendererFormat(); format.scale = 1
                let rendered = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
                continuation.resume(returning: rendered.jpegData(compressionQuality: 0.88))
            }
        }
    }

    /// Extensions cannot use UIApplication.shared; the app instance is found in the responder chain.
    private func openApp(_ url: URL) -> Bool {
        var responder: UIResponder? = self
        while let current = responder {
            if let application = current as? UIApplication {
                application.open(url, options: [:], completionHandler: nil)
                return true
            }
            responder = current.next
        }
        return false
    }

    private func finish(_ error: String?) {
        if let error { status.text = error }
        extensionContext?.completeRequest(returningItems: nil)
    }
}
