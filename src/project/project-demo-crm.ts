import { Transaction } from 'sequelize';
import {
  Company,
  Contact,
  CrmActivity,
  Deal,
  Pipeline,
  PipelineStage,
} from '../../models';

export async function seedDemoCrm(
  projectId: number,
  organizationId: number,
  userId: number,
  currency: string,
  transaction: Transaction,
) {
  const options = { transaction };
  const ids: Record<string, number[]> = {};
  const keep = <T extends { id: number }>(type: string, row: T): T => {
    (ids[type] ||= []).push(row.id);
    return row;
  };
  const day = (offset: number) => new Date(Date.now() + offset * 86400000);
  const metadata = { demo: true, demoProjectId: projectId };
  const pipeline = keep(
    'pipelines',
    await Pipeline.create(
      {
        organizationId,
        name: `[DEMO P${projectId}] CRM opportunities`,
        isDefault: false,
      },
      options,
    ),
  );
  const stages: PipelineStage[] = [];
  for (const [position, name] of [
    'Lead',
    'Qualified',
    'Proposal',
    'Won',
    'Lost',
  ].entries()) {
    stages.push(
      keep(
        'stages',
        await PipelineStage.create(
          {
            pipelineId: pipeline.id,
            name,
            position,
            probability: [10, 30, 60, 100, 0][position],
          },
          options,
        ),
      ),
    );
  }
  const scenarios = [
    [
      'Atlas Logistics',
      'Logistics',
      12000,
      0,
      30,
      'Discovery call needed; decision maker not yet confirmed.',
    ],
    [
      'Cedar Health',
      'Healthcare',
      24000,
      1,
      21,
      'Budget confirmed; security review required before proposal.',
    ],
    [
      'Bluebird Software',
      'Software',
      45000,
      2,
      -4,
      'Expected close date missed; procurement has not approved pricing.',
    ],
    [
      'Harbor Manufacturing',
      'Manufacturing',
      18000,
      3,
      -7,
      'Agreement won; schedule onboarding. This is not an invoice or cash receipt.',
    ],
    [
      'Summit Education',
      'Education',
      9000,
      4,
      -10,
      'Lost to a lower-priced competitor; revisit next quarter.',
    ],
    [
      'Willow Energy',
      'Energy',
      32000,
      2,
      7,
      'Proposal accepted in principle; final signer is unavailable this week.',
    ],
  ] as const;
  for (const [
    index,
    [name, industry, value, stage, close, note],
  ] of scenarios.entries()) {
    const company = keep(
      'companies',
      await Company.create(
        {
          organizationId,
          name: `[DEMO P${projectId}] ${name}`,
          industry,
          domain: `p${projectId}-crm-${index}.example.invalid`,
          tags: ['demo'],
          customFields: metadata,
        },
        options,
      ),
    );
    const contacts: Contact[] = [];
    for (const [person, jobTitle] of [
      'Procurement Manager',
      'Operations Director',
    ].entries()) {
      contacts.push(
        keep(
          'contacts',
          await Contact.create(
            {
              organizationId,
              companyId: company.id,
              ownerId: userId,
              firstName: ['Alex', 'Taylor'][person],
              lastName: `Demo ${index + 1}`,
              jobTitle,
              email: `p${projectId}-crm-${index}-${person}@example.invalid`,
              lifecycleStage: stage === 3 ? 'customer' : 'lead',
              tags: ['demo'],
              customFields: metadata,
            },
            options,
          ),
        ),
      );
    }
    const deal = keep(
      'deals',
      await Deal.create(
        {
          organizationId,
          companyId: company.id,
          contactId: contacts[0].id,
          ownerId: userId,
          pipelineId: pipeline.id,
          stageId: stages[stage].id,
          title: `[DEMO P${projectId}] ${name} implementation`,
          value,
          currency,
          status: stage === 3 ? 'won' : stage === 4 ? 'lost' : 'open',
          expectedCloseDate: day(close),
          ...(stage === 4
            ? { lostReason: 'Competitor offered a lower price' }
            : {}),
        },
        options,
      ),
    );
    for (const [index, type] of ['call', 'meeting', 'note'].entries()) {
      keep(
        'crmActivities',
        await CrmActivity.create(
          {
            organizationId,
            companyId: company.id,
            contactId: contacts[index % 2].id,
            dealId: deal.id,
            userId,
            type,
            subject: `[DEMO] ${name}: ${type}`,
            body: `Synthetic CRM history. ${note}`,
            occurredAt: day(-12 + index * 3),
            metadata,
          },
          options,
        ),
      );
    }
  }
  return {
    version: 1,
    ids,
    createdCounts: Object.fromEntries(
      Object.entries(ids).map(([key, values]) => [key, values.length]),
    ),
    seededAt: new Date().toISOString(),
  };
}
