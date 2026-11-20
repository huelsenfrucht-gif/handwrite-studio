import Foundation
import AVFoundation
import Speech
import Capacitor
import UIKit
import WhisperKit

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
        CAPPluginMethod(name: "accurateStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "power", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transcribeAccurate", returnType: CAPPluginReturnPromise),
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
        let live = call.getBool("live") ?? true
        Task {
            do { call.resolve(try await session.start(locale: locale, room: room, subject: subject, terms: Array(terms), live: live)) }
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

    @objc func saved(_ call: CAPPluginCall) { call.resolve(["lessons": LectureStore.all(except: session.id).filter { $0["id"] as? String != session.id }]) }

    @objc func transcribeAudio(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("Keine Aufnahme angegeben."); return }
        Task {
            do { call.resolve(try await LectureSession.transcribeSaved(id: id)) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func accurateStatus(_ call: CAPPluginCall) { call.resolve(AccurateRecognizer.shared.status()) }

    /// Battery state, so the slow, power-hungry recognition can suggest the charger first.
    @objc func power(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let d = UIDevice.current; d.isBatteryMonitoringEnabled = true
            let charging = d.batteryState == .charging || d.batteryState == .full
            call.resolve(["level": d.batteryLevel < 0 ? 1 : Double(d.batteryLevel), "charging": charging || d.batteryState == .unknown, "lowPower": ProcessInfo.processInfo.isLowPowerModeEnabled])
        }
    }

    /// Recognises a saved recording again with a large Whisper model (downloaded once).
    @objc func transcribeAccurate(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("Keine Aufnahme angegeben."); return }
        guard id != session.id else { call.reject("Diese Aufnahme läuft noch."); return }
        Task {
            do {
                let result = try await AccurateRecognizer.shared.transcribe(id: id) { [weak self] phase, fraction in
                    self?.notifyListeners("accurate", data: ["phase": phase, "progress": fraction])
                }
                call.resolve(result)
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), id != session.id else { call.reject("Diese Aufnahme läuft noch."); return }
        if call.getBool("audioOnly") == true {
            guard AccurateRecognizer.shared.activeId != id else { call.reject("Die genaue Erkennung braucht die Tonaufnahme gerade noch."); return }
            try? FileManager.default.removeItem(at: LectureStore.audio(id)); call.resolve(); return
        }
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
    /// Recordings take a lot of space (about 30 MB per lesson). The text stays, the sound goes after a week.
    static let keepAudioDays: Double = 7
    static func all(except running: String? = nil) -> [[String: Any]] {
        let fm = FileManager.default
        let files = (try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "json" }.compactMap { load($0.deletingPathExtension().lastPathComponent) }
            .map { var d = $0; let id = d["id"] as? String ?? "", url = audio(id)
                if id != running, id != AccurateRecognizer.shared.activeId, let a = try? fm.attributesOfItem(atPath: url.path), let date = a[.modificationDate] as? Date,
                   Date().timeIntervalSince(date) > keepAudioDays * 86400 { try? fm.removeItem(at: url) }
                let size = (try? fm.attributesOfItem(atPath: url.path))?[.size] as? NSNumber
                d["hasAudio"] = size != nil; d["audioMB"] = (size?.doubleValue ?? 0) / 1_000_000
                return d }
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
    func start(locale: String, room: String = "near", subject: String = "general", terms: [String] = [], live: Bool = true) async throws -> [String: Any] {
        log("start(\(locale)) aufgerufen, läuft schon: \(id != nil)")
        if id != nil { return snapshot() } // already running: show it instead of failing
        guard AVAudioSession.sharedInstance().recordPermission == .granted, SFSpeechRecognizer.authorizationStatus() == .authorized else { throw LectureError.noAccess }
        let newId = "lesson-\(Int(Date().timeIntervalSince1970))"
        queue.sync {
            id = newId; self.locale = locale; self.room = room; self.subject = subject; self.terms = terms; voice = VoiceLift(room: room); startedAt = Date(); passages = []; markers = []; volatile = ""; recorded = 0; pauseReason = ""
            prep = live ? "loading" : "off"; prepProgress = 0; pending = []; pendingSeconds = 0; missedText = false; transcriber = nil
        }
        do { try configureAudioSession(); try startEngine() }
        catch { queue.sync { id = nil; state = "idle"; prep = "idle" }; file = nil; LectureStore.remove(id: newId); throw error }
        observe()
        changed(persist: true)
        // Without live text only the sound is recorded (saves battery); the text is recognised afterwards.
        if live { prepareTranscriber(locale: locale, terms: terms, for: newId) } else { log("Live-Text aus: nur Aufnahme") }
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
        // Far away speakers: "measurement" switches off the system's voice processing, which is tuned
        // for someone talking right into the iPad and tends to swallow a distant voice. VoiceLift evens the level instead.
        let far = queue.sync(execute: { room }) != "near"
        try s.setCategory(.playAndRecord, mode: far ? .measurement : .default, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetoothA2DP])
        log("Audio-Sitzung: aktivieren")
        try s.setActive(true, options: [])
        log("Audio-Sitzung: aktiv")
        if far { preferRoomMicrophone(s, hall: queue.sync(execute: { room }) == "hall") }
    }

    /// Far away speakers. The iPad lies in front of the student with the screen towards them, so its back
    /// faces the board and the teacher. Listen through the rear microphone with a pickup that favours the
    /// front of the room and damps what happens right in front of the screen (pencil taps, the student's
    /// own movements): sub-cardioid in a classroom, cardioid in a hall (less echo). All-round as fallback.
    /// Only with the built-in microphone (not when a headset or external microphone is in use).
    private func preferRoomMicrophone(_ s: AVAudioSession, hall: Bool) {
        guard s.currentRoute.inputs.first?.portType == .builtInMic, let mic = s.availableInputs?.first(where: { $0.portType == .builtInMic }) else { return }
        let sources = mic.dataSources ?? []
        log("Mikrofon: verfügbar \(sources.map { "\($0.dataSourceName) [\($0.orientation?.rawValue ?? "-")] \(($0.supportedPolarPatterns ?? []).map { $0.rawValue })" })")
        let wanted: [AVAudioSession.PolarPattern] = hall ? [.cardioid, .subcardioid, .omnidirectional] : [.subcardioid, .cardioid, .omnidirectional]
        let back = sources.first { $0.orientation == .back }
        var choice: (AVAudioSessionDataSourceDescription, AVAudioSession.PolarPattern)?
        if let back, let pattern = wanted.first(where: { back.supportedPolarPatterns?.contains($0) == true }) { choice = (back, pattern) }
        else if let any = sources.first(where: { $0.supportedPolarPatterns?.contains(.omnidirectional) == true }) { choice = (any, .omnidirectional) }
        guard let (source, pattern) = choice else { log("Mikrofon: keine passende Richtung verfügbar"); return }
        do {
            try source.setPreferredPolarPattern(pattern)
            try mic.setPreferredDataSource(source)
            try s.setPreferredInput(mic)
            log("Mikrofon: \(source.dataSourceName), \(pattern.rawValue)")
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
        var result = snapshot(); result["hasAudio"] = true; if let id, let size = (try? FileManager.default.attributesOfItem(atPath: LectureStore.audio(id).path))?[.size] as? NSNumber { result["audioMB"] = size.doubleValue / 1_000_000 }
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

// MARK: - Genau erkennen (Whisper)

/// A second, slower and more accurate pass over the finished recording with OpenAI's
/// Whisper (large-v3 turbo, via WhisperKit on the Neural Engine). The model is downloaded
/// once (about 0.6 GB) and then works offline; no audio ever leaves the iPad.
final class AccurateRecognizer {
    static let shared = AccurateRecognizer()
    private var kit: WhisperKit?
    private var busy = false
    /// The lesson being transcribed right now (its recording must not be deleted meanwhile).
    private(set) var activeId: String?
    private let preferred = "openai_whisper-large-v3-v20240930_turbo_632MB"

    private var base: URL {
        let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Whisper", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        var u = url; var values = URLResourceValues(); values.isExcludedFromBackup = true; try? u.setResourceValues(values)
        return url
    }
    /// The best model this iPad can run comfortably.
    private var variant: String {
        let support = WhisperKit.recommendedModels()
        return support.supported.contains(preferred) ? preferred : support.default
    }
    private var marker: URL { base.appendingPathComponent("\(variant).ready") }

    func status() -> [String: Any] {
        ["downloaded": FileManager.default.fileExists(atPath: marker.path), "model": variant, "sizeMB": variant.contains("632MB") ? 632 : 500, "busy": busy]
    }

    func transcribe(id: String, report: @escaping (String, Double) -> Void) async throws -> [String: Any] {
        guard !busy else { throw LectureError.unavailable("Die genaue Erkennung läuft bereits.") }
        busy = true; activeId = id; defer { busy = false; activeId = nil }
        guard var data = LectureStore.load(id) else { throw LectureError.unavailable("Die Aufnahme wurde nicht gefunden.") }
        let audio = LectureStore.audio(id)
        guard FileManager.default.fileExists(atPath: audio.path) else { throw LectureError.unavailable("Zu diesem Transkript gibt es keine Tonaufnahme mehr.") }
        // A few extra minutes if the app is sent to the background meanwhile.
        let bg = await UIApplication.shared.beginBackgroundTask(withName: "Genau erkennen")
        defer { Task { @MainActor in UIApplication.shared.endBackgroundTask(bg) } }

        let kit = try await prepare(report: report)
        report("transcribe", 0)
        let language = String((data["locale"] as? String ?? "de-DE").prefix(2))
        var options = DecodingOptions(task: .transcribe, language: language, temperatureFallbackCount: 3, skipSpecialTokens: true, chunkingStrategy: .vad)
        // Subject words as a short prompt make names and technical terms more likely.
        let terms = (data["terms"] as? [String] ?? []).prefix(40).joined(separator: ", ")
        if !terms.isEmpty, let tokenizer = kit.tokenizer {
            options.promptTokens = Array(tokenizer.encode(text: " " + terms).filter { $0 < tokenizer.specialTokens.specialTokenBegin }.prefix(120))
        }
        let poll = Task { while !Task.isCancelled { report("transcribe", kit.progress.fractionCompleted); try? await Task.sleep(nanoseconds: 500_000_000) } }
        defer { poll.cancel() }
        log("Genau erkennen: \(variant), Sprache \(language)")
        let results = try await kit.transcribe(audioPath: audio.path, decodeOptions: options)
        // Whisper sometimes "hears" sentences in silence or noise. Drop segments the model itself
        // was unsure about, and those where the recording is (almost) silent.
        let loudness = SegmentLoudness(url: audio)
        let passages = results.flatMap { $0.segments }.compactMap { seg -> [String: Any]? in
            let text = seg.text.replacingOccurrences(of: "<\\|[^|]*\\|>", with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            let rms = loudness?.rms(from: Double(seg.start), to: Double(seg.end)) ?? 1
            let made = seg.noSpeechProb > 0.5 || seg.avgLogprob < -1.0 || seg.compressionRatio > 2.4 || rms < (loudness?.silence ?? 0)
            log(String(format: "Abschnitt %.1f–%.1f s: noSpeech %.2f, logprob %.2f, ratio %.2f, Pegel %.4f%@", seg.start, seg.end, seg.noSpeechProb, seg.avgLogprob, seg.compressionRatio, rms, made ? " → verworfen" : ""))
            return text.isEmpty || made ? nil : ["start": Double(seg.start), "end": Double(seg.end), "text": text]
        }
        guard !passages.isEmpty else { throw LectureError.unavailable("In der Tonaufnahme wurde keine Sprache gefunden.") }
        data["passages"] = passages
        data["accurate"] = true
        data["missedText"] = false
        data["state"] = "stopped"
        LectureStore.save(data, id: id)
        report("done", 1)
        // Give the memory back right away (about 1 GB); the model loads again from the iPad next time.
        await kit.unloadModels(); self.kit = nil
        return data
    }

    private func prepare(report: @escaping (String, Double) -> Void) async throws -> WhisperKit {
        if let kit { return kit }
        let name = variant
        var folder: URL
        // Already on the iPad: use it directly, without asking the server (works offline, e.g. at school).
        let folderKey = "whisperFolder.\(name)"
        let standard = base.appendingPathComponent("models/argmaxinc/whisperkit-coreml/\(name)")
        if FileManager.default.fileExists(atPath: marker.path), let saved = UserDefaults.standard.string(forKey: folderKey),
           FileManager.default.fileExists(atPath: base.appendingPathComponent(saved).path) {
            folder = base.appendingPathComponent(saved)
        } else if FileManager.default.fileExists(atPath: marker.path), FileManager.default.fileExists(atPath: standard.appendingPathComponent("AudioEncoder.mlmodelc").path) {
            folder = standard
        } else {
            do {
                report("download", 0)
                folder = try await WhisperKit.download(variant: name, downloadBase: base) { progress in report("download", progress.fractionCompleted) }
            } catch {
                throw LectureError.unavailable("Das Sprachmodell konnte nicht geladen werden. Für den einmaligen Download (ca. 0,6 GB) braucht das iPad Internet.")
            }
            FileManager.default.createFile(atPath: marker.path, contents: Data())
            // Remember where it is, relative to the (stable) app folder.
            if folder.path.hasPrefix(base.path) { UserDefaults.standard.set(String(folder.path.dropFirst(base.path.count + 1)), forKey: folderKey) }
        }
        // Compiling the model for this iPad takes a while the first time only.
        report("load", 0)
        // The Neural Engine is fastest, but compiling the large model for it can need more memory
        // than iOS allows (the system then stops the compiler). Then the graphics chip is used,
        // and remembered, so the next time it starts right away.
        let key = "whisperUsesGPU"
        func load(gpu: Bool) async throws -> WhisperKit {
            log("Genau erkennen: Modell vorbereiten (\(gpu ? "Grafikchip" : "Neural Engine"))")
            let compute = gpu ? ModelComputeOptions(melCompute: .cpuAndGPU, audioEncoderCompute: .cpuAndGPU, textDecoderCompute: .cpuAndGPU) : nil
            let config = WhisperKitConfig(model: name, downloadBase: base, modelFolder: folder.path, computeOptions: compute, verbose: false, logLevel: .error, prewarm: true, load: true, download: false)
            return try await WhisperKit(config)
        }
        let kit: WhisperKit
        // The large models do not fit through the Neural Engine compiler on iPads (seen on M1).
        if UserDefaults.standard.bool(forKey: key) || name.contains("large") {
            kit = try await load(gpu: true)
        } else {
            do { kit = try await load(gpu: false) }
            catch {
                log("Genau erkennen: Neural Engine fehlgeschlagen (\(error.localizedDescription)), nehme Grafikchip")
                UserDefaults.standard.set(true, forKey: key)
                report("load", 0)
                do { kit = try await load(gpu: true) }
                catch { throw LectureError.unavailable("Das Sprachmodell konnte auf diesem iPad nicht vorbereitet werden. Starte das iPad neu und versuche es noch einmal.") }
            }
        }
        self.kit = kit
        return kit
    }
}


/// Loudness of parts of a recording, to tell speech from silence (catches made-up Whisper text).
final class SegmentLoudness {
    private let file: AVAudioFile
    /// Below this level a part counts as silent (relative to the loud parts of this recording).
    let silence: Float
    init?(url: URL) {
        guard let f = try? AVAudioFile(forReading: url) else { return nil }
        file = f
        // Sample the recording in 1-second blocks (at most 600 spread over the file) and take the loud end as reference.
        let rate = f.processingFormat.sampleRate, total = Double(f.length) / rate
        let step = max(1, total / 600)
        var levels: [Float] = []
        var t = 0.0
        while t < total { if let v = SegmentLoudness.read(f, from: t, to: min(total, t + 1)) { levels.append(v) }; t += step }
        levels.sort()
        let loud = levels.isEmpty ? 0 : levels[Int(Double(levels.count - 1) * 0.9)]
        silence = loud * 0.08
    }
    func rms(from: Double, to: Double) -> Float? { SegmentLoudness.read(file, from: from, to: max(to, from + 0.2)) }
    private static func read(_ f: AVAudioFile, from: Double, to: Double) -> Float? {
        let rate = f.processingFormat.sampleRate
        let start = AVAudioFramePosition(from * rate), count = AVAudioFrameCount(max(1, min(Double(f.length - start), (to - from) * rate)))
        guard start >= 0, start < f.length, let buf = AVAudioPCMBuffer(pcmFormat: f.processingFormat, frameCapacity: count) else { return nil }
        f.framePosition = start
        guard (try? f.read(into: buf, frameCount: count)) != nil, let ch = buf.floatChannelData, buf.frameLength > 0 else { return nil }
        var sum: Float = 0; let n = Int(buf.frameLength)
        for i in 0..<n { let v = ch[0][i]; sum += v * v }
        return (sum / Float(n)).squareRoot()
    }
}
