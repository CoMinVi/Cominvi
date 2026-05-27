const cacheActiveFrameList = new Map()

function createDeferred() {
  let resolve = null
  let reject = null
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export class ActiveFrame {
  constructor(
    file,
    { process = () => {}, hardwareAcceleration = 'prefer-hardware' } = {}
  ) {
    const deferred = createDeferred()
    this.loading = deferred.promise
    this._resolveLoading = deferred.resolve
    this._rejectLoading = deferred.reject

    this.file = file
    this.process = process
    this.hardwareAcceleration = hardwareAcceleration
    this.manifest = null
    this.data = null
    this.decoder = null
    this.frame = null
    this.desideredFrame = 0
    this.enabled = true
    this.framesByTimestamp = new Map()
    this.frameProcessed = null
    this._pendingFrame = null
    this.config = null

    this.init().catch((err) => this._rejectLoading(err))
  }

  async init() {
    if (!cacheActiveFrameList.has(this.file)) {
      cacheActiveFrameList.set(this.file, this.loadBinary(this.file))
    }

    const loading = await cacheActiveFrameList.get(this.file)
    const { manifest, data } = loading

    this.manifest = manifest
    this.data = data

    this.manifest.frames.forEach((frame) => {
      frame.data = new Uint8Array(this.data, frame.o, frame.l)
      this.framesByTimestamp.set(frame.t, frame.i)
    })

    await this.initDecoder()
    this._resolveLoading()
  }

  async loadBinary(file) {
    const res = await fetch(file)
    const fullBuffer = await res.arrayBuffer()

    const footer = new DataView(fullBuffer, fullBuffer.byteLength - 4)
    const manifestOffset = footer.getUint32(0, true)

    const manifestBytes = new Uint8Array(
      fullBuffer,
      manifestOffset,
      fullBuffer.byteLength - 4 - manifestOffset
    )
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes))

    return {
      manifest,
      data: fullBuffer,
    }
  }

  decodeDescription(description) {
    const binaryString = atob(description)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  async initDecoder() {
    const VideoDecoderCtor = window.VideoDecoder
    const baseConfig = {
      codec: this.manifest.codec,
      codedWidth: this.manifest.width,
      codedHeight: this.manifest.height,
      colorSpace: {
        primaries: 'bt709',
        transfer: 'bt709',
        matrix: 'bt709',
        fullRange: false,
      },
      description: this.decodeDescription(this.manifest.description),
    }

    const candidates = [
      {
        ...baseConfig,
        hardwareAcceleration: this.hardwareAcceleration,
        optimizeForLatency: true,
      },
      { ...baseConfig, hardwareAcceleration: this.hardwareAcceleration },
      { ...baseConfig, optimizeForLatency: true },
      { ...baseConfig },
    ]

    this.config = null
    for (const candidate of candidates) {
      const support = await VideoDecoderCtor.isConfigSupported(candidate)
      if (support.supported) {
        this.config = candidate
        break
      }
    }

    if (!this.config) {
      throw new Error('Decoder not supported')
    }

    this.decoder = new VideoDecoderCtor({
      output: this.outputFrame.bind(this),
      error: (e) => {
        console.error('ActiveFrame decoder error:', e)
      },
    })

    this.decoder.configure(this.config)
  }

  async outputFrame(frame) {
    if (!this.enabled) {
      frame.close()
      return
    }

    const timestampToFrameId = this.framesByTimestamp.get(frame.timestamp)
    if (this.desideredFrame !== timestampToFrameId) {
      frame.close()
      return
    }

    this.frame = timestampToFrameId

    if (this.process) {
      await this.process(frame)
    }

    this.frameProcessed = timestampToFrameId
    this._pendingFrame = null
    frame.close()
  }

  redrawFrame(desideredFrame) {
    if (!this.manifest || !this.enabled || !this.decoder) return
    this.frame = null
    this._pendingFrame = null
    this.setFrame(desideredFrame)
  }

  setFrame(desideredFrame) {
    if (!this.manifest || !this.enabled || !this.decoder) return
    const EncodedVideoChunkCtor = window.EncodedVideoChunk

    desideredFrame = Math.round(Number(desideredFrame))
    const maxFrame = Math.max(0, this.manifest.totalFrames - 1)
    desideredFrame = Math.min(Math.max(desideredFrame, 0), maxFrame)
    this.desideredFrame = desideredFrame

    if (this.desideredFrame === this.frame) return
    if (this.desideredFrame === this._pendingFrame) return
    this._pendingFrame = desideredFrame

    const frameMeta = this.manifest.frames[this.desideredFrame]
    if (!frameMeta) return

    const isSequential =
      this.frame !== null &&
      this.desideredFrame === this.frame + 1 &&
      frameMeta.ty === 'delta'

    if (isSequential) {
      this.decoder.decode(
        new EncodedVideoChunkCtor({
          type: frameMeta.ty,
          timestamp: frameMeta.t,
          data: frameMeta.data,
        })
      )
      return
    }

    if (
      this.decoder.decodeQueueSize > 0 ||
      this.decoder.state !== 'configured'
    ) {
      this.decoder.reset()
      this.decoder.configure(this.config)
    }

    if (frameMeta.ty === 'key') {
      this.decoder.decode(
        new EncodedVideoChunkCtor({
          type: frameMeta.ty,
          timestamp: frameMeta.t,
          data: frameMeta.data,
        })
      )
      return
    }

    let keyFrame = null
    for (let i = this.desideredFrame; i >= 0; i -= 1) {
      const candidate = this.manifest.frames[i]
      if (candidate.ty === 'key') {
        keyFrame = candidate
        break
      }
    }

    if (!keyFrame || !keyFrame.data) return

    this.decoder.decode(
      new EncodedVideoChunkCtor({
        type: keyFrame.ty,
        timestamp: keyFrame.t,
        data: keyFrame.data,
      })
    )

    for (let i = keyFrame.i + 1; i <= this.desideredFrame; i += 1) {
      const frame = this.manifest.frames[i]
      if (frame.ty !== 'delta') break
      this.decoder.decode(
        new EncodedVideoChunkCtor({
          type: frame.ty,
          timestamp: frame.t,
          data: frame.data,
        })
      )
    }
  }

  destroy() {
    cacheActiveFrameList.delete(this.file)
    this.enabled = false
    this.framesByTimestamp.clear()
    this.process = null
    this.frameProcessed = null
    this.data = null
    this.manifest = null
    this.file = null
    try {
      if (this.decoder && this.decoder.state !== 'closed') {
        this.decoder.close()
      }
    } catch (e) {
      // ignore
    }
    this.decoder = null
  }
}
