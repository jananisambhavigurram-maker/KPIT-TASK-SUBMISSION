import 'dotenv/config';
import { PrismaClient, Priority, ProjectStatus, Role, WorkStatus } from '@prisma/client';
import { hashPassword } from '../backend/src/auth.js';

const prisma = new PrismaClient();
const due = (days: number) => new Date(Date.now() + days * 86_400_000);

async function main() {
  await prisma.backgroundJob.deleteMany(); await prisma.notification.deleteMany(); await prisma.activity.deleteMany(); await prisma.task.deleteMany();
  await prisma.userStory.deleteMany(); await prisma.project.deleteMany(); await prisma.user.deleteMany();
  const passwordHash = await hashPassword('DemoPass123!');
  const [admin, manager, alice, bob, charlie] = await Promise.all([
    prisma.user.create({ data: { name: 'Priya Admin', email: 'admin@agileflow.demo', passwordHash, role: Role.ADMIN } }),
    prisma.user.create({ data: { name: 'Rahul Manager', email: 'manager@agileflow.demo', passwordHash, role: Role.MANAGER } }),
    prisma.user.create({ data: { name: 'Alice Patel', email: 'alice@agileflow.demo', passwordHash, role: Role.MEMBER } }),
    prisma.user.create({ data: { name: 'Bob Kumar', email: 'bob@agileflow.demo', passwordHash, role: Role.MEMBER } }),
    prisma.user.create({ data: { name: 'Charlie Shah', email: 'charlie@agileflow.demo', passwordHash, role: Role.MEMBER } })
  ]);
  const commerce = await prisma.project.create({ data: { key: 'ECOM', name: 'E-Commerce Platform', description: 'A secure and intuitive shopping platform for modern customers.', status: ProjectStatus.ACTIVE } });
  const food = await prisma.project.create({ data: { key: 'FOOD', name: 'Food Delivery App', description: 'Restaurant discovery, ordering, and real-time delivery updates.', status: ProjectStatus.ACTIVE } });
  const stories = await Promise.all([
    prisma.userStory.create({ data: { projectId: commerce.id, key: 'ECOM-US-001', title: 'Customer Registration', description: 'As a customer, I want to create an account so I can save and manage my orders.', status: WorkStatus.IN_PROGRESS, priority: Priority.HIGH } }),
    prisma.userStory.create({ data: { projectId: commerce.id, key: 'ECOM-US-002', title: 'Product Search', description: 'As a shopper, I want to find products quickly using search and filters.', status: WorkStatus.TODO, priority: Priority.HIGH } }),
    prisma.userStory.create({ data: { projectId: commerce.id, key: 'ECOM-US-003', title: 'Shopping Cart', description: 'As a shopper, I want to manage selected products before checkout.', status: WorkStatus.IN_PROGRESS, priority: Priority.MEDIUM } }),
    prisma.userStory.create({ data: { projectId: commerce.id, key: 'ECOM-US-004', title: 'Secure Checkout', description: 'As a shopper, I want a secure and reliable payment flow.', status: WorkStatus.TODO, priority: Priority.HIGH } }),
    prisma.userStory.create({ data: { projectId: commerce.id, key: 'ECOM-US-005', title: 'Order Tracking', description: 'As a customer, I want to track order progress after purchase.', status: WorkStatus.TODO, priority: Priority.MEDIUM } }),
    prisma.userStory.create({ data: { projectId: food.id, key: 'FOOD-US-001', title: 'Place an Order', description: 'As a diner, I want to place an order from a nearby restaurant.', status: WorkStatus.IN_PROGRESS, priority: Priority.HIGH } })
  ]);
  const [registration, search, cart, checkout, tracking, ordering] = stories;
  await prisma.projectMember.createMany({ data: [
    ...[admin, manager, alice, bob, charlie].map(user => ({ projectId: commerce.id, userId: user.id })),
    ...[admin, manager, bob, charlie].map(user => ({ projectId: food.id, userId: user.id }))
  ] });
  await prisma.task.createMany({ data: [
    { key: 'ECOM-T-001', userStoryId: registration.id, title: 'Design registration interface', description: 'Create accessible registration form states.', status: WorkStatus.DONE, priority: Priority.HIGH, assignedToId: alice.id, dueDate: due(-5) },
    { key: 'ECOM-T-002', userStoryId: registration.id, title: 'Create registration API', description: 'Add account creation API with validation.', status: WorkStatus.DONE, priority: Priority.HIGH, assignedToId: bob.id, dueDate: due(-3) },
    { key: 'ECOM-T-003', userStoryId: registration.id, title: 'Add form validation', description: 'Show useful inline validation messages.', status: WorkStatus.IN_PROGRESS, priority: Priority.MEDIUM, assignedToId: charlie.id, dueDate: due(2) },
    { key: 'ECOM-T-004', userStoryId: registration.id, title: 'Write registration tests', description: 'Cover success and error cases.', status: WorkStatus.TODO, priority: Priority.MEDIUM, assignedToId: alice.id, dueDate: due(5) },
    { key: 'ECOM-T-005', userStoryId: search.id, title: 'Define search filters', description: 'Specify category, price, and availability filters.', status: WorkStatus.TODO, priority: Priority.HIGH, assignedToId: alice.id, dueDate: due(1) },
    { key: 'ECOM-T-006', userStoryId: search.id, title: 'Index product catalogue', description: 'Prepare fast product search queries.', status: WorkStatus.TODO, priority: Priority.MEDIUM, assignedToId: bob.id, dueDate: due(7) },
    { key: 'ECOM-T-007', userStoryId: cart.id, title: 'Implement cart persistence', description: 'Retain cart contents for signed-in customers.', status: WorkStatus.IN_PROGRESS, priority: Priority.HIGH, assignedToId: charlie.id, dueDate: due(-1) },
    { key: 'ECOM-T-008', userStoryId: cart.id, title: 'Build cart summary', description: 'Show totals, quantities, and actions.', status: WorkStatus.DONE, priority: Priority.LOW, assignedToId: alice.id, dueDate: due(-2) },
    { key: 'ECOM-T-009', userStoryId: checkout.id, title: 'Integrate payment gateway', description: 'Create secure checkout integration boundary.', status: WorkStatus.TODO, priority: Priority.HIGH, assignedToId: bob.id, dueDate: due(8) },
    { key: 'ECOM-T-010', userStoryId: tracking.id, title: 'Design order timeline', description: 'Design shipment status timeline.', status: WorkStatus.TODO, priority: Priority.MEDIUM, assignedToId: charlie.id, dueDate: due(10) },
    { key: 'FOOD-T-001', userStoryId: ordering.id, title: 'Create order API', description: 'Persist a restaurant order.', status: WorkStatus.IN_PROGRESS, priority: Priority.HIGH, assignedToId: bob.id, dueDate: due(3) }
  ] });
  await prisma.activity.createMany({ data: [{ projectId: commerce.id, actorId: manager.id, type: 'PROJECT_CREATED', message: 'Rahul created ECOM' }, { projectId: commerce.id, actorId: alice.id, type: 'TASK_STATUS_CHANGED', message: 'Alice completed ECOM-T-001' }, { projectId: commerce.id, actorId: manager.id, type: 'STORY_CREATED', message: 'Rahul created ECOM-US-005' }] });
  await prisma.notification.create({ data: { userId: alice.id, type: 'TASK_ASSIGNED', message: 'You have been assigned a new task: Write registration tests' } });
  console.log('Seeded AgileFlow competition demo data.');
  void admin;
}
main().finally(() => prisma.$disconnect());
