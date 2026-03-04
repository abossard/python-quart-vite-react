"""
Scheduler for automatic KBA draft generation

Uses APScheduler to run auto-generation at configured times.
"""

import asyncio
import logging
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from auto_gen_service import AutoGenService

logger = logging.getLogger(__name__)


class AutoGenScheduler:
    """Scheduler for automatic KBA draft generation"""
    
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.auto_gen_service = AutoGenService()
        self._job_id = "auto_gen_kba_drafts"
    
    def start(self):
        """Start the scheduler"""
        if self.scheduler is not None:
            logger.warning("Scheduler already running")
            return
        
        logger.info("Starting auto-generation scheduler")
        self.scheduler = AsyncIOScheduler()
        
        # Load settings to get schedule time
        settings = self.auto_gen_service.get_settings()
        hour, minute = self._parse_time(settings.schedule_time)
        
        # Add job with cron trigger (daily at configured time)
        self.scheduler.add_job(
            self._run_auto_generation,
            trigger=CronTrigger(hour=hour, minute=minute),
            id=self._job_id,
            name="Auto-generate KBA drafts",
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info(f"Scheduler started - will run daily at {settings.schedule_time}")
    
    def stop(self):
        """Stop the scheduler"""
        if self.scheduler is None:
            return
        
        logger.info("Stopping auto-generation scheduler")
        self.scheduler.shutdown(wait=False)
        self.scheduler = None
    
    def update_schedule(self, schedule_time: str):
        """
        Update the schedule time for auto-generation.
        
        Args:
            schedule_time: Time in HH:MM format (24-hour)
        """
        if self.scheduler is None:
            logger.warning("Scheduler not running, cannot update schedule")
            return
        
        hour, minute = self._parse_time(schedule_time)
        
        # Reschedule the job
        self.scheduler.reschedule_job(
            self._job_id,
            trigger=CronTrigger(hour=hour, minute=minute)
        )
        logger.info(f"Schedule updated - will run daily at {schedule_time}")
    
    async def run_now(self) -> dict:
        """
        Manually trigger auto-generation immediately.
        
        Returns:
            Result dictionary with generation stats
        """
        logger.info("Manual trigger of auto-generation")
        result = await self._run_auto_generation()
        return result.model_dump()
    
    async def _run_auto_generation(self):
        """Internal method to run auto-generation"""
        try:
            result = await self.auto_gen_service.run_auto_generation()
            
            if result.success:
                logger.info(
                    f"Auto-generation completed successfully: "
                    f"{result.drafts_created} drafts created"
                )
            else:
                logger.error(
                    f"Auto-generation completed with errors: "
                    f"{result.drafts_created} created, {result.drafts_failed} failed"
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Auto-generation failed with exception: {e}", exc_info=True)
            raise
    
    @staticmethod
    def _parse_time(time_str: str) -> tuple[int, int]:
        """
        Parse time string to hour and minute.
        
        Args:
            time_str: Time in HH:MM format
            
        Returns:
            Tuple of (hour, minute)
        """
        parts = time_str.split(":")
        hour = int(parts[0])
        minute = int(parts[1])
        return hour, minute


# Global scheduler instance
_scheduler: Optional[AutoGenScheduler] = None


def get_scheduler() -> AutoGenScheduler:
    """Get or create global scheduler instance"""
    global _scheduler
    if _scheduler is None:
        _scheduler = AutoGenScheduler()
    return _scheduler


def start_scheduler():
    """Start the global scheduler"""
    scheduler = get_scheduler()
    scheduler.start()


def stop_scheduler():
    """Stop the global scheduler"""
    global _scheduler
    if _scheduler is not None:
        _scheduler.stop()
        _scheduler = None
