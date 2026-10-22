import "typespec-electrodb-emitter";

@entity("mailbox", "mail")
@index("byMailbox", { pk: [Mailbox.mailboxId] })
model Mailbox {
	@visibility(Lifecycle.Read) mailboxId: string;
	name: string;
}

model CreateMailboxInput is Create<Mailbox>;
model UpdateMailboxInput is Update<Mailbox>;
model ReadMailboxOutput is Read<Mailbox>;

model MailboxPatch {
	...Update<Mailbox>;
}
