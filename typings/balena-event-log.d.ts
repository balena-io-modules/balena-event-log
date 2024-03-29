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

	interface IHaveAddEditDelete {
		add: TrackFunction;
		edit: TrackFunction;
		delete: TrackFunction;
	}

	interface Invite {
		addInviteOpen: TrackFunction;
		create: TrackFunction;
		delete: TrackFunction;
		accept: TrackFunction;
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
		organization: IHaveCreateEditDelete;
		organizationMember: IHaveAddEditDelete;
		organizationInvite: Invite;
		team: IHaveCreateEditDelete;
		teamMember: IHaveAddEditDelete;
		teamApplication: IHaveAddEditDelete;
		application: {
			create: TrackFunction;
			open: TrackFunction;
			osDownload: TrackFunction;
			osConfigDownload: TrackFunction;
			flash: TrackFunction;
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
			addDeviceModalChange: TrackFunction;
			pinToRelease: TrackFunction;
		};
		block: {
			imageReferenceCopy: TrackFunction;
		}
		applicationMember: IHaveCreateEditDelete;
		applicationInvite: Invite;
		applicationTag: IHaveCreateEditDelete & {
			set: TrackFunction;
		};
		configVariable: IHaveCreateEditDelete;
		environmentVariable: IHaveCreateEditDelete;
		serviceVariable: IHaveCreateEditDelete;
		device: {
			addNewClicked: TrackFunction;
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
			createNewClicked: TrackFunction;
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
		/** @deprecated Use applicationMember */
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
		applicationDeviceType: {
			select: TrackFunction;
		};
		applicationName: {
			set: TrackFunction;
			suggestedNameClick: TrackFunction;
		};
		page: {
			visit: TrackFunction;
		};
		navigation: {
			click: TrackFunction;
		};
		changelog: {
			click: TrackFunction;
		};
		actionsSettingsOperations: {
			click: TrackFunction;
		};
		creditsRunwayCalculator: {
			purchaseCredits: TrackFunction;
		};
		/** @deprecated Use applicationInvite */
		invite: Invite;
	}

	type BalenaEventLogConstructor = (options: object) => BalenaEventLog;
}

declare const BalenaEventLog: BalenaEventLog.BalenaEventLogConstructor;

export = BalenaEventLog;
