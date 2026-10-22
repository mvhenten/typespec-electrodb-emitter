import "typespec-electrodb-emitter";

model Owned {
	ownerId: string;
}

model Tagged<T> {
	tag: T;
}

@entity("createJob", "mail")
@index("byJob", { pk: [CreateJob.jobId] })
model CreateJob {
	@visibility(Lifecycle.Read) jobId: string;
	...Owned;
}

@entity("folder", "mail")
@index("byFolder", { pk: [Folder.folderId] })
model Folder is Owned {
	@visibility(Lifecycle.Read) folderId: string;
}

@entity("label", "mail")
@index("byLabel", { pk: [Label.labelId] })
model Label is Tagged<string> {
	@visibility(Lifecycle.Read) labelId: string;
}

model CreateJobInput is Create<CreateJob>;
model UpdateFolderInput is Update<Folder>;
model CreateLabelInput is Create<Label>;
