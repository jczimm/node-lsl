import { randomInt } from 'crypto'
import AbstractSpruceTest, {
	test,
	assert,
	errorAssert,
	generateId,
} from '@sprucelabs/test-utils'
import ArrayType from 'ref-array-napi'
import ref from 'ref-napi'
import LiblslImpl, {
	Liblsl,
	LiblslBindings,
	CreateStreamInfoOptions,
	AppendChannelsToStreamInfoOptions,
	CreateOutletOptions,
	PushSampleOptions,
	LslChannel,
	BoundOutlet,
	BoundStreamInfo,
	BoundDesc,
	BoundChild,
} from '../../Liblsl'

export default class LiblslTest extends AbstractSpruceTest {
	private static lsl: Liblsl
	private static libraryPath?: string
	private static libraryOptions?: Record<string, any>
	private static fakeBindings: LiblslBindings
	private static fakeStreamInfo: BoundStreamInfo
	private static fakeOutlet: BoundOutlet
	private static fakeDesc: BoundDesc
	private static fakeChildNamedChannels: BoundChild
	private static createStreamInfoParams?: any[]
	private static appendChildParams: any[] = []
	private static createOutletParams?: any[]
	private static pushSampleParams?: any[]
	private static appendChildValueParams: any[]
	private static localClock: number
	private static shouldThrowWhenCreatingBindings: boolean
	private static getDescriptionParams?: [BoundStreamInfo]
	private static fakeChildNamedChannel: BoundChild
	private static appendChildHitCount: number

	protected static async beforeEach(): Promise<void> {
		await super.beforeEach()

		delete this.libraryPath
		delete this.libraryOptions
		delete this.createStreamInfoParams
		delete this.createOutletParams
		delete this.pushSampleParams
		delete this.getDescriptionParams
		this.appendChildParams = []
		this.appendChildValueParams = []

		process.env.LIBLSL_PATH = generateId()

		this.fakeStreamInfo = {}
		this.fakeDesc = {}
		this.fakeOutlet = {}
		this.fakeChildNamedChannels = {}
		this.fakeChildNamedChannel = {}

		this.localClock = new Date().getTime()
		this.shouldThrowWhenCreatingBindings = false

		this.appendChildHitCount = 0

		this.fakeBindings = {
			lsl_create_streaminfo: (...params: any[]) => {
				this.createStreamInfoParams = params
				return this.fakeStreamInfo
			},
			lsl_create_outlet: (...params: any[]) => {
				this.createOutletParams = params
				return this.fakeOutlet
			},
			lsl_push_sample_ft: (...params: any[]) => {
				this.pushSampleParams = params
				return 0
			},
			lsl_local_clock: () => this.localClock,
			lsl_get_desc: (info: BoundStreamInfo) => {
				this.getDescriptionParams = [info]
				return this.fakeDesc
			},
			lsl_append_child: (...params: any) => {
				this.appendChildParams.push(params)
				if (this.appendChildHitCount === 0) {
					this.appendChildHitCount++
					return this.fakeChildNamedChannels
				}
				return this.fakeChildNamedChannel
			},
			lsl_append_child_value: (...params: any[]) => {
				this.appendChildValueParams.push(params)
			},
		}

		LiblslImpl.ffi = {
			//@ts-ignore
			Library: (path: string, options: Record<string, any>) => {
				this.libraryPath = path
				this.libraryOptions = options
				if (this.shouldThrowWhenCreatingBindings) {
					throw new Error('Failed to create bindings')
				}
				return this.fakeBindings
			},
		}

		LiblslImpl.resetInstance()
		this.lsl = LiblslImpl.getInstance()
	}

	@test()
	protected static async throwsWithMissingEnv() {
		delete process.env.LIBLSL_PATH
		const err = assert.doesThrow(() => new LiblslImpl())
		errorAssert.assertError(err, 'MISSING_PARAMETERS', {
			parameters: ['env.LIBLSL_PATH'],
		})
	}

	@test()
	protected static async throwsWhenBindingsFailToLoad() {
		this.shouldThrowWhenCreatingBindings = true
		const err = assert.doesThrow(() => new LiblslImpl())
		errorAssert.assertError(err, 'FAILED_TO_LOAD_LIBLSL', {
			liblslPath: process.env.LIBLSL_PATH,
		})
	}

	@test()
	protected static throwsWhenCreateStreamInfoIsMissingRequiredParams() {
		//@ts-ignore
		const err = assert.doesThrow(() => this.lsl.createStreamInfo())
		errorAssert.assertError(err, 'MISSING_PARAMETERS', {
			parameters: [
				'name',
				'type',
				'channelCount',
				'sampleRate',
				'channelFormat',
				'sourceId',
			],
		})
	}

	@test()
	protected static async throwsWhenAppendChannelsIsMissingRequiredParams() {
		//@ts-ignore
		const err = assert.doesThrow(() => this.lsl.appendChannelsToStreamInfo({}))
		errorAssert.assertError(err, 'MISSING_PARAMETERS', {
			parameters: ['info', 'channels'],
		})
	}

	@test()
	protected static async throwsWhenCreateOutletIsMissingRequiredParams() {
		//@ts-ignore
		const err = assert.doesThrow(() => this.lsl.createOutlet({}))
		errorAssert.assertError(err, 'MISSING_PARAMETERS', {
			parameters: ['info', 'chunkSize', 'maxBuffered'],
		})
	}

	@test()
	protected static async throwsWhenPushSampleIsMissingRequiredParams() {
		//@ts-ignore
		const err = assert.doesThrow(() => this.lsl.pushSample())
		errorAssert.assertError(err, 'MISSING_PARAMETERS', {
			parameters: ['outlet', 'sample'],
		})
	}

	@test()
	protected static async worksAsASingleton() {
		const liblsl = LiblslImpl.getInstance()
		assert.isInstanceOf(liblsl, LiblslImpl)
	}

	@test()
	protected static async singletonIsTheSame() {
		assert.isEqual(LiblslImpl.getInstance(), LiblslImpl.getInstance())
	}

	@test()
	protected static canSetInstance() {
		const fake = new FakeLiblsl()
		LiblslImpl.setInstance(fake)
		assert.isEqual(LiblslImpl.getInstance(), fake)
	}

	@test()
	protected static async createsExpectedBindingsToLiblsl() {
		process.env.LIBLSL_PATH = generateId()
		new LiblslImpl()
		assert.isEqual(this.libraryPath, process.env.LIBLSL_PATH)
		const expected = {
			lsl_create_streaminfo: [
				streamInfo,
				['string', 'string', 'int', 'double', 'int', 'string'],
			],
			lsl_create_outlet: [outletType, [streamInfo, 'int', 'int']],
			lsl_local_clock: ['double', []],
			lsl_push_sample_ft: ['void', [outletType, FloatArray, 'double']],
			lsl_get_desc: [xmlPtr, [streamInfo]],
			lsl_append_child: [xmlPtr, [xmlPtr, 'string']],
			lsl_append_child_value: [xmlPtr, [xmlPtr, 'string', 'string']],
		}
		assert.isEqual(
			JSON.stringify(this.libraryOptions),
			JSON.stringify(expected)
		)
	}

	@test()
	protected static async canCreateStreamInfoWithRequiredParams() {
		const options = this.generateRandomCreateStreamInfoOptions()
		const actual = this.lsl.createStreamInfo(options)

		assert.isEqual(actual, this.fakeStreamInfo)
		assert.isEqualDeep(this.createStreamInfoParams, Object.values(options))
	}

	@test()
	protected static async canCreateOutletWithRequiredParams() {
		const info = this.createRandomStreamInfo()
		const options = {
			info,
			chunkSize: randomInt(10),
			maxBuffered: randomInt(10),
		}
		const actual = this.lsl.createOutlet(options)
		assert.isEqualDeep(this.createOutletParams, Object.values(options))
		assert.isEqual(actual, this.fakeOutlet)
	}

	@test()
	protected static async canPushSampleWithRequiredParams() {
		const expected = [1, 2, 3]
		const options = {
			outlet: this.fakeOutlet,
			sample: expected,
		}
		this.lsl.pushSample(options)
		assert.isEqual(this.pushSampleParams?.[0], this.fakeOutlet)
		assert.isEqual(this.pushSampleParams?.[1], expected)
		assert.isEqual(this.pushSampleParams?.[2], this.localClock)
	}

	@test()
	protected static async addingSingleChannelGetsDescription() {
		const info = this.createRandomStreamInfo()
		const channel: LslChannel = this.generateRandomChannelValues()

		this.lsl.appendChannelsToStreamInfo({
			info,
			channels: [channel],
		})
		assert.isEqual(this.getDescriptionParams?.[0], info)

		assert.isEqual(this.appendChildParams?.[0][0], this.fakeDesc)
		assert.isEqual(this.appendChildParams?.[0][1], 'channels')

		assert.isEqual(this.appendChildParams?.[1][0], this.fakeChildNamedChannels)
		assert.isEqual(this.appendChildParams?.[1][1], 'channel')

		assert.isLength(this.appendChildValueParams, 3)

		for (let i = 0; i < 3; i++) {
			const param = this.appendChildValueParams[i]
			assert.isEqual(param[0], this.fakeChildNamedChannel)
		}

		assert.isEqual(this.appendChildValueParams[0][1], 'label')
		assert.isEqual(this.appendChildValueParams[1][1], 'unit')
		assert.isEqual(this.appendChildValueParams[2][1], 'type')

		assert.isEqual(this.appendChildValueParams[0][2], channel.label)
		assert.isEqual(this.appendChildValueParams[1][2], channel.unit)
		assert.isEqual(this.appendChildValueParams[2][2], channel.type)
	}

	@test()
	protected static async addingMultpleChannelsAddsChildrenToChannelsChild() {
		const info = this.createRandomStreamInfo()
		const channel1 = this.generateRandomChannelValues()
		const channel2 = this.generateRandomChannelValues()

		this.lsl.appendChannelsToStreamInfo({
			info,
			channels: [channel1, channel2],
		})

		assert.isEqual(this.appendChildParams?.[2][0], this.fakeChildNamedChannels)
		assert.isEqual(this.appendChildParams?.[2][1], 'channel')

		assert.isEqual(this.appendChildValueParams[3][2], channel2.label)
		assert.isEqual(this.appendChildValueParams[4][2], channel2.unit)
		assert.isEqual(this.appendChildValueParams[5][2], channel2.type)
	}

	private static createRandomStreamInfo() {
		return this.lsl.createStreamInfo(
			this.generateRandomCreateStreamInfoOptions()
		)
	}

	private static generateRandomChannelValues(): LslChannel {
		return {
			label: generateId(),
			type: generateId(),
			unit: generateId(),
		}
	}

	private static generateRandomCreateStreamInfoOptions() {
		return {
			name: generateId(),
			type: generateId(),
			channelCount: randomInt(1, 10),
			sampleRate: randomInt(100),
			channelFormat: randomInt(7),
			sourceId: generateId(),
		}
	}
}

class FakeLiblsl implements Liblsl {
	public createStreamInfo(_options: CreateStreamInfoOptions): BoundStreamInfo {
		return {} as BoundStreamInfo
	}

	public appendChannelsToStreamInfo(
		_options: AppendChannelsToStreamInfoOptions
	): void {}

	public createOutlet(_options: CreateOutletOptions): BoundOutlet {
		return {} as BoundOutlet
	}

	public pushSample(_options: PushSampleOptions): void {}
}

const streamInfo = ref.refType(ref.types.void)
const outletType = ref.refType(ref.types.void)
const FloatArray = ArrayType(ref.types.float)
const xmlPtr = ref.refType(ref.types.void)
