package ai.mypraxis.exactalarms

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExactAlarmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DaycheeExactAlarms")

    Function("canScheduleExactAlarms") {
      val context = requireNotNull(appContext.reactContext)
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
    }

    AsyncFunction("openSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val context = requireNotNull(appContext.reactContext)
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:${context.packageName}"))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }
  }
}
