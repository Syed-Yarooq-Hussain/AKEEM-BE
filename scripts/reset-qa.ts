import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { Organization, Project, User } from '../models';

async function resetQaOrganization() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('QA reset is disabled in production');
  }

  const email = (process.env.QA_EMAIL || 'codex.qa@example.com').toLowerCase();
  const password = process.env.QA_PASSWORD || 'QaPassword123!';
  const organizationName = process.env.QA_ORGANIZATION_NAME || 'AKEEM QA';
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const sequelize = application.get(Sequelize);
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      const organizations = await sequelize.query<{ organization_id: number }>(
        'SELECT organization_id FROM memberships WHERE user_id = :userId',
        {
          replacements: { userId: existingUser.id },
          type: QueryTypes.SELECT,
        },
      );
      for (const row of organizations) {
        await Organization.destroy({
          where: { id: row.organization_id },
          force: true,
        });
      }
      await existingUser.destroy({ force: true });
    }

    const auth = application.get(AuthService);
    const signup = (await auth.signup({
      firstName: 'Codex',
      lastName: 'QA',
      email,
      password,
      organizationName,
      timezone: 'Europe/Berlin',
      currency: 'EUR',
    })) as any;
    const project = await Project.create({
      organizationId: signup.organization.id,
      ownerId: signup.user.id,
      name: 'QA Integration Project',
      description:
        'Resettable project for automated frontend integration tests',
      status: 'active',
      settings: { qaSeed: true },
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          email,
          password,
          organizationId: signup.organization.id,
          projectId: project.id,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await application.close();
  }
}

resetQaOrganization().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'QA reset failed'}\n`,
  );
  process.exitCode = 1;
});
