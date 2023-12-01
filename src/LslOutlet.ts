import { assertOptions } from '@sprucelabs/schema'
import {
	assertValidChannelCount,
	assertValidChannelFormat,
	assertValidChunkSize,
	assertValidMaxBufferred,
	assertValidSampleRate,
} from './assertions'
import { CHANNEL_FORMATS, ChannelFormat } from './consts'
import LiblslImpl, {
	BoundOutlet,
	BoundStreamInfo,
	Liblsl,
	LslSample,
} from './Liblsl'

export default class LslOutletImpl implements LslOutlet {
	public static Class?: new (options: LslOutletOptions) => LslOutlet
	private options: LslOutletOptions
	private streamInfo: BoundStreamInfo
	private outlet: BoundOutlet

	protected constructor(options: LslOutletOptions) {
		const { sampleRate, channelFormat } = assertOptions(options, [
			'name',
			'type',
			'channelNames',
			'sampleRate',
			'channelFormat',
			'sourceId',
			'manufacturer',
			'unit',
			'chunkSize',
			'maxBuffered',
		])

		this.options = options

		const { chunkSize, maxBuffered, channelNames, ...streamInfoOptions } = this
			.options as any

		const channelCount = channelNames.length

		assertValidChannelCount(channelCount)
		assertValidSampleRate(sampleRate)
		assertValidChannelFormat(channelFormat)
		assertValidChunkSize(chunkSize)
		assertValidMaxBufferred(maxBuffered)

		delete streamInfoOptions.manufacturer
		delete streamInfoOptions.unit

		this.streamInfo = this.lsl.createStreamInfo({
			...streamInfoOptions,
			channelCount,
			channelFormat: this.lookupChannelFormat(channelFormat),
		})

		this.lsl.appendChannelsToStreamInfo({
			info: this.streamInfo,
			channels: channelNames.map((label: string) => ({
				label,
				unit: this.options.unit,
				type: this.options.type,
			})),
		})

		this.outlet = this.lsl.createOutlet({
			info: this.streamInfo,
			chunkSize: this.options.chunkSize,
			maxBuffered: this.options.maxBuffered,
		})
	}

	public static Outlet(options: LslOutletOptions): LslOutlet {
		return new (this.Class ?? this)(options)
	}

	public destroy(): void {
		this.lsl.destroyOutlet({ outlet: this.outlet })
	}

	public pushSample(sample: LslSample): void {
		const timestamp = this.lsl.localClock()
		const method = this.getPushMethod()

		this.lsl[method]({
			outlet: this.outlet,
			sample,
			timestamp,
		} as any)
	}

	private getPushMethod() {
		const channelFormat = this.options.channelFormat

		const methodMap: Record<string, keyof Liblsl> = {
			float32: 'pushSampleFt',
			string: 'pushSampleStrt',
		}

		const method = methodMap[channelFormat]

		if (!this.lsl[method]) {
			throw new Error(
				`This method currently does not support the ${this.options.channelFormat} type! Please implement it.`
			)
		}
		return method
	}

	private lookupChannelFormat(channelFormat: ChannelFormat): number {
		return CHANNEL_FORMATS.indexOf(channelFormat)
	}

	private get lsl(): Liblsl {
		return LiblslImpl.getInstance()
	}
}

export interface LslOutlet {
	destroy(): void
	pushSample(sample: LslSample): void
}

export interface LslOutletOptions {
	name: string
	type: string
	channelNames: string[]
	sampleRate: number
	channelFormat: ChannelFormat
	sourceId: string
	manufacturer: string
	unit: string
	chunkSize: number
	maxBuffered: number
}
