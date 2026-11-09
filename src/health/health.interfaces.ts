export type ServiceStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  services: Record<'postgres' | 'mongo' | 'redis', ServiceStatus>;
}
