from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0006_mensaje_directiva"),
    ]

    operations = [
        migrations.AddField(
            model_name="mensaje",
            name="responde_a",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="respuestas",
                to="chat.mensaje",
            ),
        ),
        migrations.AddField(
            model_name="mensaje",
            name="visto_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]