export * from './base.model';
export * from './core.models';
export * from './crm.models';
export * from './work.models';
export * from './hr.models';
export * from './finance.models';
export * from './automation.models';
export * from './system.models';

import { Organization, User, Membership, Role, Permission, RolePermission, Plan, Subscription } from './core.models';
import { Company, Contact, Pipeline, PipelineStage, Deal, CrmActivity } from './crm.models';
import { Project, Task, TaskAssignee, TaskComment } from './work.models';
import { Department, Employee, LeaveRequest, AttendanceEntry } from './hr.models';
import { FinancialAccount, TransactionCategory, Transaction, Invoice, InvoiceItem, Payment, Expense } from './finance.models';
import { AiAgent, AiConversation, AiMessage, KnowledgeDocument, Automation, AutomationRun, Integration, AiAgentTeam, AiAgentTeamMember, AiAgentDelegation } from './automation.models';
import { FileAsset, Notification, AuditLog } from './system.models';

export const SAAS_MODELS = [Organization, User, Membership, Role, Permission, RolePermission, Plan, Subscription,
  Company, Contact, Pipeline, PipelineStage, Deal, CrmActivity, Project, Task, TaskAssignee, TaskComment,
  Department, Employee, LeaveRequest, AttendanceEntry, FinancialAccount, TransactionCategory, Transaction,
  Invoice, InvoiceItem, Payment, Expense, AiAgent, AiConversation, AiMessage, KnowledgeDocument, Automation,
  AutomationRun, Integration, AiAgentTeam, AiAgentTeamMember, AiAgentDelegation, FileAsset, Notification, AuditLog];
