package expo.modules.emergencycomms

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telephony.SmsManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class EmergencyCommsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EmergencyComms")

    Function("canSendDirectSms") { true }

    Function("canImmediateCall") { true }

    // "idle" | "ringing" | "offhook" | "unknown" — lets JS chain one call after another
    Function("getCallState") {
      val context = appContext.reactContext ?: return@Function "unknown"
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED
      ) {
        return@Function "unknown"
      }
      val tm = context.getSystemService(android.content.Context.TELEPHONY_SERVICE) as? TelephonyManager
        ?: return@Function "unknown"
      when (tm.callState) {
        TelephonyManager.CALL_STATE_IDLE -> "idle"
        TelephonyManager.CALL_STATE_RINGING -> "ringing"
        TelephonyManager.CALL_STATE_OFFHOOK -> "offhook"
        else -> "unknown"
      }
    }

    AsyncFunction("sendSms") { phone: String, message: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
        throw Exception("SEND_SMS permission not granted")
      }
      val smsManager =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          context.getSystemService(SmsManager::class.java)
            ?: @Suppress("DEPRECATION") SmsManager.getDefault()
        } else {
          @Suppress("DEPRECATION")
          SmsManager.getDefault()
        }
      val parts = smsManager.divideMessage(message)
      if (parts.size <= 1) {
        smsManager.sendTextMessage(phone, null, message, null, null)
      } else {
        smsManager.sendMultipartTextMessage(phone, null, parts, null, null)
      }
    }

    AsyncFunction("immediateCall") { phone: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
        throw Exception("CALL_PHONE permission not granted")
      }
      val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$phone")).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      val activity = appContext.currentActivity
      if (activity != null) activity.startActivity(intent) else context.startActivity(intent)
    }
  }
}
