from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.downloader.models import DownloadJob, DownloadJobMetrics


@receiver(post_save, sender=DownloadJob)
def ensure_job_metrics(sender, instance, created, **kwargs):
    if created:
        DownloadJobMetrics.objects.get_or_create(job=instance)
