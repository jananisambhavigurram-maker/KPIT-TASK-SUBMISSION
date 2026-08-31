export type WorkStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type Role = 'ADMIN' | 'MANAGER' | 'MEMBER';
export interface User { id: string; name: string; email: string; role: Role; createdAt: string }
export interface Task { id: string; key: string; title: string; description: string; status: WorkStatus; priority: Priority; assignedToId: string | null; assignedTo?: User | null; dueDate: string | null; createdAt: string; updatedAt: string; userStory?: Story }
export interface Story { id: string; key: string; projectId: string; title: string; description: string; status: WorkStatus; priority: Priority; tasks: Task[]; project?: Project; createdAt: string; updatedAt: string }
export interface Activity { id: string; message: string; type: string; createdAt: string }
export interface Project { id: string; key: string; name: string; description: string; status: ProjectStatus; createdAt: string; updatedAt: string; storyCount?: number; taskCount?: number; completedCount?: number; progress?: number; statusCounts?: { todo: number; inProgress: number; done: number }; stories?: Story[]; activities?: Activity[] }
export interface Notification { id: string; userId: string; type: string; message: string; isRead: boolean; createdAt: string; user?: { name: string } }
export interface Dashboard { totals: { projects: number; activeProjects: number; stories: number; tasks: number; myTasks: number; completedTasks: number; overdueTasks: number; unreadNotifications: number }; status: Record<WorkStatus, number>; priority: Record<Priority, number>; projectProgress: Project[] }
export interface SearchResults { projects: Project[]; stories: Story[]; tasks: Task[] }
