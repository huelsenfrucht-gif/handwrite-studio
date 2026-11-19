import Foundation
import AVFoundation
import Speech
import Capacitor

/// "Transkribieren": records from the microphone and turns speech into text
/// entirely on the device. Keeps running while the app is in the background or the
/// iPad is locked (UIBackgroundModes: audio). The transcript and the audio are saved
/// continuously, so a lesson survives a crash or the app being closed.
///
/// iPadOS 26+: SpeechAnalyzer + SpeechTranscriber (made for long-form audio).
/// Older systems: SFSpeechRecognizer with on-device recognition, restarted every minute.
@objc(LectureRecorderPlugin)
public class LectureRecorderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LectureRecorderPlugin"
    public let jsName = "LectureRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "mark", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "current", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saved", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transcribeAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
    ]

    private var session: LectureSession { LectureSession.shared }

    public override func load() {
        session.onChange = { [weak self] payload in self?.notifyListeners("change", data: payload) }
    }

    @objc func availability(_ call: CAPPluginCall) {
        let locale = Locale(identifier: call.getString("locale") ?? "de-DE")
        Task {
            let info = await LectureSession.availability(locale: locale)
            call.resolve(info)
        }
    }

    @objc func requestAccess(_ call: CAPPluginCall) {
        AVAudioSession.sharedInstance().requestRecordPermission { mic in
            SFSpeechRecognizer.requestAuthorization { status in
                call.resolve(["microphone": mic, "speech": status == .authorized])
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        let locale = call.getString("locale") ?? "de-DE"
        let room = call.getString("room") ?? "near", subject = call.getString("subject") ?? "general"
        let terms = (call.getArray("terms") as? [String] ?? []).prefix(100).map { String($0.prefix(60)) }
        Task {
            do { call.resolve(try await session.start(locale: locale, room: room, subject: subject, terms: Array(terms))) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func pause(_ call: CAPPluginCall) { session.pause(reason: "user"); call.resolve(session.snapshot()) }
    @objc func resume(_ call: CAPPluginCall) {
        do { try session.resume(); call.resolve(session.snapshot()) } catch { call.reject(error.localizedDescription) }
    }
    @objc func mark(_ call: CAPPluginCall) { call.resolve(["t": session.mark()]) }

    @objc func stop(_ call: CAPPluginCall) {
        Task { call.resolve(await session.stop()) }
    }

    @objc func current(_ call: CAPPluginCall) { call.resolve(session.snapshot()) }

    @objc func saved(_ call: CAPPluginCall) { call.resolve(["lessons": LectureStore.all().filter { $0["id"] as? String != session.id }]) }

    @objc func transcribeAudio(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("Keine Aufnahme angegeben."); return }
        Task {
            do { call.resolve(try await LectureSession.transcribeSaved(id: id)) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), id != session.id else { call.reject("Diese Aufnahme läuft noch."); return }
        LectureStore.remove(id: id); call.resolve()
    }
}

// MARK: - Storage

enum LectureStore {
    static var folder: URL {
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("Lectures", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        // Lessons stay on this device; they are not part of iCloud backups.
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        var mutable = url; try? mutable.setResourceValues(values)
        return url
    }
    static func json(_ id: String) -> URL { folder.appendingPathComponent("\(id).json") }
    static func audio(_ id: String) -> URL { folder.appendingPathComponent("\(id).m4a") }
    static func save(_ data: [String: Any], id: String) {
        guard let bytes = try? JSONSerialization.data(withJSONObject: data) else { return }
        try? bytes.write(to: json(id), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    static func load(_ id: String) -> [String: Any]? {
        guard let bytes = try? Data(contentsOf: json(id)) else { return nil }
        return try? JSONSerialization.jsonObject(with: bytes) as? [String: Any]
    }
    static func all() -> [[String: Any]] {
        let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "json" }.compactMap { load($0.deletingPathExtension().lastPathComponent) }
            .map { var d = $0; d["hasAudio"] = FileManager.default.fileExists(atPath: audio(d["id"] as? String ?? "").path); return d }
            .sorted { ($0["startedAt"] as? Double ?? 0) > ($1["startedAt"] as? Double ?? 0) }
    }
    static func remove(id: String) {
        try? FileManager.default.removeItem(at: json(id))
        try? FileManager.default.removeItem(at: audio(id))
    }
}

// MARK: - Transcription engines

/// One recognised passage, in seconds of recorded audio (pauses do not count).
struct Passage { var start: Double; var end: Double; var text: String }

protocol Transcriber: AnyObject {
    var onFinal: ((Passage) -> Void)? { get set }
    var onVolatile: ((String) -> Void)? { get set }
    func append(_ buffer: AVAudioPCMBuffer, at time: Double)
    func finish() async
}

enum LectureError: LocalizedError {
    case noAccess, unavailable(String), busy
    var errorDescription: String? {
        switch self {
        case .noAccess: return "Bitte erlaube Mikrofon und Spracherkennung in den Einstellungen des iPad."
        case .unavailable(let why): return why
        case .busy: return "Es läuft bereits eine Aufnahme."
        }
    }
}

/// `terms`: names and technical words of the subject; the recogniser prefers them.
func makeTranscriber(locale: Locale, terms: [String] = [], progress: ((Double) -> Void)? = nil) async throws -> Transcriber {
    if #available(iOS 26.0, *), SpeechTranscriber.isAvailable {
        if let t = try? await AnalyzerTranscriber(locale: locale, terms: terms, progress: progress) { return t }
    }
    return try ClassicTranscriber(locale: locale, terms: terms)
}

@available(iOS 26.0, *)
final class AnalyzerTranscriber: Transcriber {
    var onFinal: ((Passage) -> Void)?
    var onVolatile: ((String) -> Void)?
    private let transcriber: SpeechTranscriber
    private let analyzer: SpeechAnalyzer
    private let input: AsyncStream<AnalyzerInput>.Continuation
    private let format: AVAudioFormat
    private var converter: AVAudioConverter?
    private var results: Task<Void, Never>?

    init(locale: Locale, terms: [String] = [], progress: ((Double) -> Void)? = nil) async throws {
        guard let supported = await SpeechTranscriber.supportedLocale(equivalentTo: locale) else { throw LectureError.unavailable("Diese Sprache wird auf diesem iPad nicht unterstützt.") }
        transcriber = SpeechTranscriber(locale: supported, transcriptionOptions: [], reportingOptions: [.volatileResults], attributeOptions: [.audioTimeRange])
        // The language model is downloaded once by the system and then works offline.
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            let poll = Task { while !Task.isCancelled { progress?(request.progress.fractionCompleted); try? await Task.sleep(nanoseconds: 300_000_000) } }
            defer { poll.cancel() }
            try await request.downloadAndInstall()
        }
        analyzer = SpeechAnalyzer(modules: [transcriber])
        if !terms.isEmpty {
            let context = AnalysisContext()
            context.contextualStrings[.general] = terms
            try? await analyzer.setContext(context)
        }
        guard let best = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]) else { throw LectureError.unavailable("Kein passendes Audioformat.") }
        format = best
        let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
        input = continuation
        let analyzer = self.analyzer
        Task { try? await analyzer.start(inputSequence: stream) }
        let transcriber = self.transcriber
        results = Task { [weak self] in
            do {
                for try await result in transcriber.results {
                    let text = String(result.text.characters).trimmingCharacters(in: .whitespacesAndNewlines)
                    if result.isFinal {
                        if !text.isEmpty { self?.onFinal?(Passage(start: result.range.start.seconds, end: result.range.end.seconds, text: text)) }
                        self?.onVolatile?("")
                    } else { self?.onVolatile?(text) }
                }
            } catch {}
        }
    }

    func append(_ buffer: AVAudioPCMBuffer, at time: Double) {
        guard let converted = convert(buffer) else { return }
        input.yield(AnalyzerInput(buffer: converted))
    }

    private func convert(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
        if buffer.format == format { return buffer }
        if converter == nil || converter?.inputFormat != buffer.format { converter = AVAudioConverter(from: buffer.format, to: format) }
        guard let converter else { return nil }
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * format.sampleRate / buffer.format.sampleRate) + 32
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else { return nil }
        var fed = false, error: NSError?
        converter.convert(to: out, error: &error) { _, status in
            if fed { status.pointee = .noDataNow; return nil }
            fed = true; status.pointee = .haveData; return buffer
        }
        return error == nil && out.frameLength > 0 ? out : nil
    }

    func finish() async {
        input.finish()
        try? await analyzer.finalizeAndFinishThroughEndOfInput()
        _ = await results?.value
    }
}

/// Pre-iPadOS 26: on-device SFSpeechRecognizer. A request is restarted about every
/// 50 seconds so long lessons never hit the recogniser's limits.
final class ClassicTranscriber: Transcriber {
    var onFinal: ((Passage) -> Void)?
    var onVolatile: ((String) -> Void)?
    private let recognizer: SFSpeechRecognizer
    private let terms: [String]
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var requestStart = 0.0
    private var pending = 0
    private var drained: CheckedContinuation<Void, Never>?

    init(locale: Locale, terms: [String] = []) throws {
        self.terms = terms
        guard let r = SFSpeechRecognizer(locale: locale), r.isAvailable else { throw LectureError.unavailable("Die Spracherkennung ist auf diesem iPad gerade nicht verfügbar.") }
        guard r.supportsOnDeviceRecognition else { throw LectureError.unavailable("Dieses iPad kann diese Sprache nicht ohne Internet erkennen.") }
        recognizer = r
    }

    private func begin(at time: Double) {
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.requiresOnDeviceRecognition = true
        req.shouldReportPartialResults = true
        if #available(iOS 16.0, *) { req.addsPunctuation = true }
        req.taskHint = .dictation
        if !terms.isEmpty { req.contextualStrings = terms }
        let offset = time
        pending += 1
        task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let text = result.bestTranscription.formattedString
                if result.isFinal {
                    let segs = result.bestTranscription.segments
                    if !text.isEmpty { self.onFinal?(Passage(start: offset + (segs.first?.timestamp ?? 0), end: offset + ((segs.last.map { $0.timestamp + $0.duration }) ?? 0), text: text)) }
                    self.onVolatile?("")
                } else { self.onVolatile?(text) }
            }
            if result?.isFinal == true || error != nil { self.done() }
        }
        request = req; requestStart = time
    }

    private func done() {
        pending -= 1
        if pending <= 0, let c = drained { drained = nil; c.resume() }
    }

    func append(_ buffer: AVAudioPCMBuffer, at time: Double) {
        if request == nil { begin(at: time) }
        else if time - requestStart > 50 { request?.endAudio(); begin(at: time) }
        request?.append(buffer)
    }

    func finish() async {
        request?.endAudio(); request = nil
        guard pending > 0 else { return }
        await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
            drained = c
            DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in if let c = self?.drained { self?.drained = nil; c.resume() } }
        }
    }
}

// MARK: - Recording session

final class LectureSession {
    static let shared = LectureSession()
    var onChange: (([String: Any]) -> Void)?

    private(set) var id: String?
    private var state = "idle" // idle | recording | paused
    private var pauseReason = ""
    private var startedAt = Date()
    private var locale = "de-DE"
    private var room = "near" // near | classroom | hall
    private var subject = "general"
    private var terms: [String] = []
    private var voice = VoiceLift(room: "near")
    private var passages: [Passage] = []
    private var markers: [Double] = []
    private var volatile = ""
    private var engine: AVAudioEngine?
    private var file: AVAudioFile?
    private var transcriber: Transcriber?
    private var recorded = 0.0 // seconds of audio, pauses excluded
    private var prep = "idle" // loading | ready | unavailable
    private var prepProgress = 0.0
    private var level = 0.0
    private var lastLevelSent = Date.distantPast
    private var pending: [(AVAudioPCMBuffer, Double)] = [] // audio held back until speech recognition is ready
    private var pendingSeconds = 0.0
    private var missedText = false
    private let queue = DispatchQueue(label: "lecture.state")
    private var observers: [NSObjectProtocol] = []

    static func availability(locale: Locale) async -> [String: Any] {
        var engine = "none", why = ""
        if #available(iOS 26.0, *), SpeechTranscriber.isAvailable, await SpeechTranscriber.supportedLocale(equivalentTo: locale) != nil { engine = "analyzer" }
        else if let r = SFSpeechRecognizer(locale: locale), r.supportsOnDeviceRecognition { engine = "classic" }
        else { why = "Dieses iPad kann diese Sprache nicht ohne Internet erkennen." }
        return ["available": engine != "none", "engine": engine, "reason": why,
                "microphone": AVAudioSession.sharedInstance().recordPermission == .granted,
                "speech": SFSpeechRecognizer.authorizationStatus() == .authorized]
    }

    func snapshot() -> [String: Any] {
        queue.sync {
            var d: [String: Any] = ["state": state, "reason": pauseReason, "duration": recorded, "volatile": volatile, "prep": prep, "progress": prepProgress, "level": level, "missedText": missedText]
            if let id { d["id"] = id; d["startedAt"] = startedAt.timeIntervalSince1970 * 1000; d["locale"] = locale; d["room"] = room; d["subject"] = subject }
            d["passages"] = passages.map { ["start": $0.start, "end": $0.end, "text": $0.text] }
            d["markers"] = markers
            return d
        }
    }

    private func changed(persist: Bool = false) {
        let snap = snapshot()
        if persist, let id { var d = snap; d["volatile"] = nil; d["terms"] = queue.sync { terms }; LectureStore.save(d, id: id) }
        DispatchQueue.main.async { self.onChange?(snap) }
    }

    /// Recording starts at once; speech recognition (and a first-time language download)
    /// is prepared alongside. Audio recorded meanwhile is handed over as soon as it is ready.
    func start(locale: String, room: String = "near", subject: String = "general", terms: [String] = []) async throws -> [String: Any] {
        log("start(\(locale)) aufgerufen, läuft schon: \(id != nil)")
        if id != nil { return snapshot() } // already running: show it instead of failing
        guard AVAudioSession.sharedInstance().recordPermission == .granted, SFSpeechRecognizer.authorizationStatus() == .authorized else { throw LectureError.noAccess }
        let newId = "lesson-\(Int(Date().timeIntervalSince1970))"
        queue.sync {
            id = newId; self.locale = locale; self.room = room; self.subject = subject; self.terms = terms; voice = VoiceLift(room: room); startedAt = Date(); passages = []; markers = []; volatile = ""; recorded = 0; pauseReason = ""
            prep = "loading"; prepProgress = 0; pending = []; pendingSeconds = 0; missedText = false; transcriber = nil
        }
        do { try configureAudioSession(); try startEngine() }
        catch { queue.sync { id = nil; state = "idle"; prep = "idle" }; file = nil; LectureStore.remove(id: newId); throw error }
        observe()
        changed(persist: true)
        prepareTranscriber(locale: locale, terms: terms, for: newId)
        return snapshot()
    }

    private func prepareTranscriber(locale: String, terms: [String], for lesson: String) {
        Task {
            log("Spracherkennung: vorbereiten")
            let t = try? await makeTranscriber(locale: Locale(identifier: locale), terms: terms) { [weak self] fraction in
                self?.queue.async { self?.prepProgress = fraction }; self?.changed()
            }
            guard queue.sync(execute: { id }) == lesson else { await t?.finish(); return } // stopped meanwhile
            log("Spracherkennung: \(t.map { String(describing: type(of: $0)) } ?? "nicht verfügbar")")
            guard let t else { queue.sync { prep = "unavailable"; pending = []; missedText = true }; changed(persist: true); return }
            t.onFinal = { [weak self] p in self?.queue.async { self?.passages.append(p) }; self?.changed(persist: true) }
            t.onVolatile = { [weak self] text in self?.queue.async { self?.volatile = text }; self?.changed() }
            queue.sync {
                for (buffer, time) in pending { t.append(buffer, at: time) }
                pending = []; pendingSeconds = 0; transcriber = t; prep = "ready"
            }
            changed()
        }
    }

    private static func copy(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
        guard let out = AVAudioPCMBuffer(pcmFormat: buffer.format, frameCapacity: buffer.frameLength) else { return nil }
        out.frameLength = buffer.frameLength
        let n = Int(buffer.frameLength), channels = Int(buffer.format.channelCount)
        if let src = buffer.floatChannelData, let dst = out.floatChannelData { for c in 0..<channels { dst[c].update(from: src[c], count: n) } }
        else if let src = buffer.int16ChannelData, let dst = out.int16ChannelData { for c in 0..<channels { dst[c].update(from: src[c], count: n) } }
        return out
    }

    private func configureAudioSession() throws {
        let s = AVAudioSession.sharedInstance()
        log("Audio-Sitzung: Kategorie setzen")
        // playAndRecord + mixWithOthers: works next to other audio in the app (e.g. an ad video)
        // instead of having to tear it down first, which can block the audio system.
        try s.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetoothA2DP])
        log("Audio-Sitzung: aktivieren")
        try s.setActive(true, options: [])
        log("Audio-Sitzung: aktiv")
        if queue.sync(execute: { room }) != "near" { preferRoomMicrophone(s) }
    }

    /// Far away speakers: use the built-in microphone with an all-round pickup where the
    /// iPad offers one (only when no headset or external microphone is in use).
    private func preferRoomMicrophone(_ s: AVAudioSession) {
        guard s.currentRoute.inputs.first?.portType == .builtInMic, let mic = s.availableInputs?.first(where: { $0.portType == .builtInMic }) else { return }
        guard let source = mic.dataSources?.first(where: { $0.supportedPolarPatterns?.contains(.omnidirectional) == true }) else { log("Mikrofon: keine Rundum-Richtung verfügbar"); return }
        do {
            try source.setPreferredPolarPattern(.omnidirectional)
            try mic.setPreferredDataSource(source)
            try s.setPreferredInput(mic)
            log("Mikrofon: Rundum-Richtung (\(source.dataSourceName))")
        } catch { log("Mikrofon: \(error.localizedDescription)") }
    }

    private func startEngine() throws {
        guard let id else { return }
        log("Engine: vorbereiten")
        let engine = AVAudioEngine(), input = engine.inputNode, format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { throw LectureError.unavailable("Kein Mikrofon gefunden.") }
        if file == nil {
            let url = LectureStore.audio(id)
            let settings: [String: Any] = [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: format.sampleRate, AVNumberOfChannelsKey: format.channelCount, AVEncoderBitRateKey: 48000]
            file = try AVAudioFile(forWriting: url, settings: settings, commonFormat: format.commonFormat, interleaved: format.isInterleaved)
        }
        input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in
            guard let self else { return }
            self.voice.process(buffer)
            try? self.file?.write(from: buffer)
            let seconds = Double(buffer.frameLength) / format.sampleRate
            var rms: Float = 0
            if let data = buffer.floatChannelData, buffer.frameLength > 0 { let n = Int(buffer.frameLength); var sum: Float = 0; for i in 0..<n { sum += data[0][i] * data[0][i] }; rms = (sum / Float(n)).squareRoot() }
            let send = self.queue.sync { () -> Bool in
                let time = self.recorded
                if let t = self.transcriber { t.append(buffer, at: time) }
                else if self.prep == "loading" {
                    // Hold back up to three minutes; longer gaps are filled from the audio file later.
                    if self.pendingSeconds < 180, let c = LectureSession.copy(buffer) { self.pending.append((c, time)); self.pendingSeconds += seconds } else { self.missedText = true }
                }
                self.recorded += seconds
                self.level = Double(min(1, rms * 6))
                if Date().timeIntervalSince(self.lastLevelSent) > 0.2 { self.lastLevelSent = Date(); return true }
                return false
            }
            if send { self.changed() }
        }
        engine.prepare()
        log("Engine: starten")
        try engine.start()
        log("Engine: läuft")
        self.engine = engine
        queue.sync { state = "recording"; pauseReason = "" }
    }

    private func stopEngine() {
        engine?.inputNode.removeTap(onBus: 0)
        engine?.stop()
        engine = nil
    }

    private func observe() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let self, let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt, let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            if type == .began { self.pause(reason: "interrupted") }
            else if self.queue.sync(execute: { self.pauseReason }) == "interrupted" { try? self.resume() }
        })
        observers.append(center.addObserver(forName: .AVAudioEngineConfigurationChange, object: nil, queue: .main) { [weak self] _ in
            guard let self, self.queue.sync(execute: { self.state }) == "recording" else { return }
            self.stopEngine(); try? self.startEngine(); self.changed()
        })
    }

    func pause(reason: String) {
        guard queue.sync(execute: { state }) == "recording" else { return }
        stopEngine()
        queue.sync { state = "paused"; pauseReason = reason }
        changed(persist: true)
    }

    func resume() throws {
        guard queue.sync(execute: { state }) == "paused" else { return }
        try configureAudioSession(); try startEngine()
        changed(persist: true)
    }

    func mark() -> Double {
        let t = queue.sync { () -> Double in markers.append(recorded); return recorded }
        changed(persist: true)
        return t
    }

    func stop() async -> [String: Any] {
        guard id != nil else { return snapshot() }
        stopEngine()
        let t = queue.sync { () -> Transcriber? in let t = transcriber; transcriber = nil; if prep == "loading" { missedText = true }; pending = []; prep = "idle"; level = 0; return t }
        await t?.finish()
        file = nil
        observers.forEach(NotificationCenter.default.removeObserver); observers = []
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        queue.sync { state = "stopped"; volatile = "" }
        changed(persist: true)
        var result = snapshot(); result["hasAudio"] = true
        queue.sync { id = nil; state = "idle" }
        return result
    }

    /// Turns a saved recording into text again (e.g. when live recognition was not possible).
    static func transcribeSaved(id: String) async throws -> [String: Any] {
        guard var data = LectureStore.load(id) else { throw LectureError.unavailable("Die Aufnahme wurde nicht gefunden.") }
        let file = try AVAudioFile(forReading: LectureStore.audio(id))
        let t = try await makeTranscriber(locale: Locale(identifier: data["locale"] as? String ?? "de-DE"), terms: data["terms"] as? [String] ?? [])
        let found = PassageBox()
        t.onFinal = { p in found.add(p) }
        let format = file.processingFormat, chunk: AVAudioFrameCount = 16384
        var time = 0.0
        while file.framePosition < file.length {
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: chunk) else { break }
            try file.read(into: buffer, frameCount: chunk)
            if buffer.frameLength == 0 { break }
            t.append(buffer, at: time)
            time += Double(buffer.frameLength) / format.sampleRate
            if t is ClassicTranscriber { try? await Task.sleep(nanoseconds: 2_000_000) }
        }
        await t.finish()
        let passages = found.sorted()
        data["passages"] = passages.map { ["start": $0.start, "end": $0.end, "text": $0.text] }
        data["duration"] = time
        data["state"] = "stopped"
        LectureStore.save(data, id: id)
        return data
    }
}

/// Thread-safe collection of recognised passages (results arrive on other threads).
/// Makes a distant voice easier to recognise: removes rumble below about 90 Hz (traffic,
/// footsteps, air conditioning) and slowly lifts quiet speech towards a steady level,
/// with a soft limit so loud moments never clip. Does nothing for "near".
final class VoiceLift {
    private let enabled: Bool
    private let maxGain: Float
    private var gain: Float = 1
    private var lastIn: [Float] = [], lastOut: [Float] = []
    init(room: String) {
        enabled = room != "near"
        maxGain = room == "hall" ? 8 : 4
    }
    func process(_ buffer: AVAudioPCMBuffer) {
        guard enabled, let data = buffer.floatChannelData, buffer.frameLength > 0 else { return }
        let n = Int(buffer.frameLength), channels = Int(buffer.format.channelCount)
        let a = Float(exp(-2 * Double.pi * 90 / buffer.format.sampleRate))
        if lastIn.count != channels { lastIn = Array(repeating: 0, count: channels); lastOut = lastIn }
        var sum: Float = 0
        for c in 0..<channels {
            let x = data[c]
            var px = lastIn[c], py = lastOut[c]
            for i in 0..<n { let v = x[i]; let y = a * (py + v - px); px = v; py = y; x[i] = y; if c == 0 { sum += y * y } }
            lastIn[c] = px; lastOut[c] = py
        }
        let rms = (sum / Float(n)).squareRoot()
        // Only follow actual sound, not silence (that would just amplify noise).
        if rms > 0.002 {
            let target = min(maxGain, max(1, 0.06 / rms))
            gain += (target - gain) * (target < gain ? 0.3 : 0.05)
        }
        let g = gain
        for c in 0..<channels { let x = data[c]; for i in 0..<n { x[i] = tanhf(x[i] * g) } }
    }
}

final class PassageBox {
    private var items: [Passage] = []
    private let queue = DispatchQueue(label: "lecture.passages")
    func add(_ p: Passage) { queue.sync { items.append(p) } }
    func sorted() -> [Passage] { queue.sync { items.sorted { $0.start < $1.start } } }
}

/// Diagnostics for the console (visible with `devicectl … --console` or in Xcode).
func log(_ message: String) {
    print("[Transkribieren] \(message)"); fflush(stdout)
}
