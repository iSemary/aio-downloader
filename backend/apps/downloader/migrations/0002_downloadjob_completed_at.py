from django.db import migrations, models


def backfill_completed_at(apps, schema_editor):
    DownloadJob = apps.get_model("downloader", "DownloadJob")
    qs = DownloadJob.objects.filter(status="done", completed_at__isnull=True).exclude(file_path="")
    for job in qs.iterator(chunk_size=500):
        job.completed_at = job.updated_at
        job.save(update_fields=["completed_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("downloader", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="downloadjob",
            name="completed_at",
            field=models.DateTimeField(
                blank=True,
                help_text="When the file finished downloading (used for retention).",
                null=True,
            ),
        ),
        migrations.RunPython(backfill_completed_at, migrations.RunPython.noop),
    ]
