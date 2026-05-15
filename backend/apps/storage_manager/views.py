from pathlib import Path

from django.conf import settings
from django.db.models import Count, Sum
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.downloader.models import DownloadJob, DownloadedFile


def _safe_relative_path(filename: str) -> Path | None:
    if not filename or ".." in filename or filename.startswith("/"):
        return None
    rel = Path(filename)
    try:
        full = (settings.MEDIA_ROOT / rel).resolve()
        media = settings.MEDIA_ROOT.resolve()
        full.relative_to(media)
    except Exception:  # noqa: BLE001
        return None
    return rel


class StorageListView(APIView):
    def get(self, request):
        user = request.user
        root: Path = settings.MEDIA_ROOT
        root.mkdir(parents=True, exist_ok=True)
        rel_paths = (
            DownloadedFile.objects.filter(user=user, is_deleted=False)
            .values_list("file_path", flat=True)
            .distinct()
        )
        items = []
        for rel in rel_paths:
            fp = root / rel
            if not fp.is_file():
                continue
            dfile = (
                DownloadedFile.objects.filter(user=user, file_path=rel, is_deleted=False)
                .order_by("-created_at")
                .first()
            )
            stat = fp.stat()
            items.append(
                {
                    "path": rel.replace("\\", "/"),
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "job_id": str(dfile.job_id) if dfile else None,
                }
            )
        items.sort(key=lambda x: x["path"])
        return Response(items)


class StorageStatsView(APIView):
    def get(self, request):
        user = request.user
        qs = DownloadedFile.objects.filter(user=user, is_deleted=False, job__status=DownloadJob.Status.DONE)
        total_bytes = qs.aggregate(s=Sum("file_size_bytes"))["s"] or 0
        count = qs.count()
        by_platform = list(
            qs.values("job__platform").annotate(bytes=Sum("file_size_bytes"), n=Count("id")).order_by("-bytes")
        )
        return Response(
            {
                "total_bytes": total_bytes,
                "file_count": count,
                "by_platform": by_platform,
            }
        )


class StorageDeleteView(APIView):
    def delete(self, request, filename: str):
        rel = _safe_relative_path(filename)
        if rel is None:
            return Response({"detail": "Invalid path."}, status=400)
        user = request.user
        uid = str(user.uuid)
        if rel.parts and rel.parts[0] != uid:
            if not DownloadedFile.objects.filter(user=user, file_path=str(rel.as_posix())).exists():
                return Response({"detail": "Invalid path."}, status=400)
        full = settings.MEDIA_ROOT / rel
        if not full.is_file():
            return Response({"detail": "Not found."}, status=404)
        dfile = DownloadedFile.objects.filter(user=user, file_path=str(rel.as_posix()), is_deleted=False).first()
        if not dfile:
            return Response({"detail": "Forbidden."}, status=403)
        full.unlink(missing_ok=True)
        dfile.is_deleted = True
        dfile.file_size_bytes = 0
        dfile.save(update_fields=["is_deleted", "file_size_bytes"])
        return Response({"deleted": True}, status=status.HTTP_200_OK)
