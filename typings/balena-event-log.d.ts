// tslint:disable-next-line:no-namespace
declare namespace BalenaEventLog {
	type IdentityProviderKeys = 'analyticsClient' | 'ga' | 'gs';

	interface Context {
		organizationId?: number;
		memberId?: number;
		teamId?: number;
		applicationId?: number;
		deviceId?: number;
		deviceUuid?: string;
	}

	type TrackFunction = (
		jsonData?: object | null,
		context?: Context,
		callback?: () => void,
	) => Promise<void>;

	interface IHaveCreateEditDelete {
		create: TrackFunction;
		edit: TrackFunction;
		delete: TrackFunction;
	}

	interface BalenaEventLog {
		userId: number | null;

		init(type: string): Promise<void>;
		start(
			user: object,
			deviceIds?: string[],
			callback?: () => void,
		): Promise<void>;
		end(callback?: () => void): Promise<void>;
		create(
			type: string,
			jsonData: object | null,
			applicationId: number | null,
			deviceId: number | null,
			callback?: () => void,
		): Promise<void>;
		getDistinctId(
			callback?: () => void,
		): Promise<
			Array<{
				analyticsClient: string | null;
				ga: string | null;
				gs: string | null;
			}>
		>;
		identify(
			ids: {
				analyticsClient?: string;
				ga?: string;
				gs?: string;
			},
			callback?: () => void,
		): Promise<void>;

		user: {
			login: TrackFunction;
			logout: TrackFunction;
			signup: TrackFunction;
			passwordCreate: TrackFunction;
			passwordEdit: TrackFunction;
			emailEdit: TrackFunction;
			delete: TrackFunction;
		};
		apiKey: IHaveCreateEditDelete;
		publicKey: {
			create: TrackFunction;
			delete: TrackFunction;
		};
		application: {
			create: TrackFunction;
			open: TrackFunction;
			osDownload: TrackFunction;
			osConfigDownload: TrackFunction;
			publicUrlEnable: TrackFunction;
			publicUrlDisable: TrackFunction;
			restart: TrackFunction;
			supportAccessEnable: TrackFunction;
			supportAccessDisable: TrackFunction;
			purge: TrackFunction;
			reboot: TrackFunction;
			shutdown: TrackFunction;
			applicationTypeChange: TrackFunction;
			delete: TrackFunction;
			pinToRelease: TrackFunction;
		};
		applicationTag: IHaveCreateEditDelete & {
			set: TrackFunction;
		};
		configVariable: IHaveCreateEditDelete;
		environmentVariable: IHaveCreateEditDelete;
		serviceVariable: IHaveCreateEditDelete;
		device: {
			open: TrackFunction;
			rename: TrackFunction;
			terminalOpen: TrackFunction;
			terminalClose: TrackFunction;
			publicUrlEnable: TrackFunction;
			publicUrlDisable: TrackFunction;
			lockOverrideEnable: TrackFunction;
			lockOverrideDisable: TrackFunction;
			restart: TrackFunction;
			move: TrackFunction;
			hostOsUpdate: TrackFunction;
			hostOsUpdateHide: TrackFunction;
			hostOsUpdateFailed: TrackFunction;
			hostOsUpdateSucceeded: TrackFunction;
			localModeEnable: TrackFunction;
			localModeDisable: TrackFunction;
			supportAccessEnable: TrackFunction;
			supportAccessDisable: TrackFunction;
			purge: TrackFunction;
			reboot: TrackFunction;
			shutdown: TrackFunction;
			delete: TrackFunction;
			deactivate: TrackFunction;
			pinToRelease: TrackFunction;
			diagnosticsDownload: TrackFunction;
			diagnosticsOpen: TrackFunction;
			diagnosticsRun: TrackFunction;
			healthChecksOpen: TrackFunction;
			healthChecksRun: TrackFunction;
			supervisorStateOpen: TrackFunction;
		};
		release: {
			addReleaseOpen: TrackFunction;
			instructionsCopy: TrackFunction;
			installLinkClick: TrackFunction;
			gettingStartedClick: TrackFunction;
			deployFromUrl: TrackFunction;
		};
		gettingStartedGuide: {
			modalShow: TrackFunction;
			modalHide: TrackFunction;
			modalSkip: TrackFunction;
			modalGuideOpen: TrackFunction;
		};
		onboarding: {
			stepClick: TrackFunction;
			whatNextItemClick: TrackFunction;
		};
		deviceConfigVariable: IHaveCreateEditDelete;
		deviceEnvironmentVariable: IHaveCreateEditDelete;
		deviceServiceVariable: IHaveCreateEditDelete;
		deviceTag: IHaveCreateEditDelete & {
			set: TrackFunction;
		};
		releaseTag: IHaveCreateEditDelete & {
			set: TrackFunction;
		};
		members: IHaveCreateEditDelete;
		billing: {
			paymentInfoUpdate: TrackFunction;
			planChange: TrackFunction;
			invoiceDownload: TrackFunction;
		};
		deployToBalena: {
			open: TrackFunction;
			cancel: TrackFunction;
		};
		page: {
			visit: TrackFunction;
		};
		navigation: {
			click: TrackFunction;
		};
		invite: {
			addInviteOpen: TrackFunction;
			create: TrackFunction;
			delete: TrackFunction;
			accept: TrackFunction;
		};
	}

	type BalenaEventLogConstructor = (options: object) => BalenaEventLog;
}

declare const BalenaEventLog: BalenaEventLog.BalenaEventLogConstructor;

export = BalenaEventLog;
