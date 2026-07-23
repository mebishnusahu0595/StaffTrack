import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import {
  createDrawerNavigator, 
  DrawerContentScrollView, 
  DrawerItemList 
} from "@react-navigation/drawer";
import { ActivityIndicator, Image, View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Divider, IconButton } from "react-native-paper";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import { appIconSource, AppIcon } from "../components/AppIcon";
import { useAuth } from "../auth/AuthContext";
import { useLocalNotifications } from "../hooks/useLocalNotifications";
import { useRealtime } from "../hooks/useRealtime";
import { LoginScreen } from "../auth/LoginScreen";
import { AttendanceScreen } from "../screens/AttendanceScreen";
import { DayEndReportScreen } from "../screens/DayEndReportScreen";
import { ExpenseScreen } from "../screens/ExpenseScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { TasksScreen } from "../screens/TasksScreen";
import { FormsScreen } from "../screens/FormsScreen";
import { MonthlyReportScreen } from "../screens/MonthlyReportScreen";
import { IssuesScreen } from "../screens/IssuesScreen";
import { LeaveRequestScreen } from "../screens/LeaveRequestScreen";
import { SalarySlipScreen } from "../screens/SalarySlipScreen";
import { ProjectsScreen } from "../screens/ProjectsScreen";
import { FilesScreen } from "../screens/FilesScreen";

// Manager Screens
import { ManagerHomeScreen } from "../screens/manager/ManagerHomeScreen";
import { ManagerTeamScreen } from "../screens/manager/ManagerTeamScreen";
import { ManagerAttendanceScreen } from "../screens/manager/ManagerAttendanceScreen";
import { ManagerTasksScreen } from "../screens/manager/ManagerTasksScreen";
import { ManagerReportsScreen } from "../screens/manager/ManagerReportsScreen";
import { ManagerFormsScreen } from "../screens/manager/ManagerFormsScreen";
import { ManagerIssuesScreen } from "../screens/manager/ManagerIssuesScreen";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainDrawerParamList = {
  Home: undefined;
  Files: undefined;
  Projects: undefined;
  Tasks: undefined;
  Forms: undefined;
  Issues: undefined;
  Attendance: undefined;
  DayEndReport: undefined;
  Expenses: undefined;
  MonthlyReport: undefined;
  Profile: undefined;
  LeaveRequest: undefined;
  SalarySlips: undefined;
  ManagerHome: undefined;
  ManagerAttendance: undefined;
  ManagerTasks: undefined;
  ManagerReports: undefined;
  ManagerForms: undefined;
  ManagerIssues: undefined;
};

export type ManagerDrawerParamList = {
  ManagerHome: undefined;
  ManagerTeam: undefined;
  ManagerAttendance: undefined;
  Files: undefined;
  Projects: undefined;
  Attendance: undefined;
  DayEndReport: undefined;
  ManagerTasks: undefined;
  ManagerReports: undefined;
  ManagerForms: undefined;
  ManagerIssues: undefined;
  Tasks: undefined;
  MonthlyReport: undefined;
  SalarySlips: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<MainDrawerParamList>();

export const navigationRef = createNavigationContainerRef<any>();

export function AppNavigator() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  // Firebase-free notifications: poll backend + raise native local notifications.
  useLocalNotifications();
  // Live WebSocket sync (e.g. start the work timer the instant a late check-in is approved).
  useRealtime();

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleNotificationType = (type: any) => {
      if (navigationRef.isReady()) {
        if (type && typeof type === "string") {
          console.log("[Push Redirection] Redirecting user to screen for type:", type);
          const isManager = user?.role === "MANAGER";
          if (type.startsWith("TASK_")) {
            navigationRef.navigate(isManager ? "ManagerTasks" : "Tasks" as any);
          } else if (type === "DAY_END_REPORT") {
            navigationRef.navigate(isManager ? "ManagerReports" : "DayEndReport" as any);
          } else {
            navigationRef.navigate(isManager ? "ManagerHome" : "Home" as any);
          }
        }
      } else {
        setTimeout(() => handleNotificationType(type), 200);
      }
    };

    // Check cold start notifications (app closed when notification was tapped)
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (response) {
          const type = response.notification.request.content.data?.type;
          console.log("[Push Redirection] Cold start notification tap detected. Type:", type);
          handleNotificationType(type);
        }
      })
      .catch(err => {
        console.error("[Push Redirection] Failed checking cold start notification:", err);
      });

    // Listen for notification taps when the app is in background or active
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        const type = response.notification.request.content.data?.type;
        console.log("[Push Redirection] Background/active notification tap detected. Type:", type);
        handleNotificationType(type);
      } catch (err) {
        console.error("[Push Redirection] Tap action redirection failed:", err);
      }
    });

    return () => {
      responseSubscription.remove();
    };
  }, [isAuthenticated]);

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#1A202C" size="large" />
        <Text style={{ marginTop: 12 }}>Loading StaffTrack</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          user?.role === "MANAGER" ? (
            <Stack.Screen component={ManagerDrawer} name="Main" />
          ) : (
            <Stack.Screen component={MainDrawer} name="Main" />
          )
        ) : (
          <Stack.Screen component={LoginScreen} name="Login" />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function CustomDrawerContent(props: any) {
  const { user, signOut } = useAuth();

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
      <View style={styles.drawerHeader}>
        <View style={styles.headerTop}>
          <Image source={require("../../assets/logo.png")} style={styles.drawerLogo} />
          <IconButton 
            icon={appIconSource("close")}
            size={24} 
            iconColor="#1A202C"
            onPress={() => props.navigation.closeDrawer()} 
          />
        </View>
        <Text style={styles.drawerTitle}>StaffTrack</Text>
        <Text style={styles.drawerUser}>{user?.name || "Staff Member"}</Text>
      </View>
      <Divider style={styles.divider} />
      
      <View style={styles.drawerList}>
        <DrawerItemList {...props} />
      </View>

      <Divider style={styles.divider} />
      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={() => {
          props.navigation.closeDrawer();
          void signOut();
        }}
      >
        <AppIcon name="logout" size={20} color="#DC2626" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ padding: 16, alignItems: "center" }}>
        <Text style={{ fontSize: 11, color: "#94A3B8", fontWeight: "600" }}>Version 1.0.7</Text>
      </View>
    </DrawerContentScrollView>
  );
}

function MainDrawer() {
  return (
    <Drawer.Navigator
      useLegacyImplementation={false}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: "#FFFFFF", elevation: 2, shadowOpacity: 0.1 },
        headerTitleStyle: { color: "#1A202C", fontWeight: "700" },
        headerLeft: () => (
          <IconButton
            icon={appIconSource("menu")}
            size={24}
            iconColor="#1A202C"
            onPress={() => navigation.toggleDrawer()}
            style={{ marginLeft: 8 }}
          />
        ),
        drawerActiveTintColor: "#1A202C",
        drawerInactiveTintColor: "#64748B",
        drawerLabelStyle: { fontWeight: "600", marginLeft: -16 },
        drawerItemStyle: { borderRadius: 8, marginHorizontal: 8, marginVertical: 2 },
      })}
    >
      <Drawer.Screen 
        component={HomeScreen} 
        name="Home" 
        options={{ 
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="home" size={size} /> 
        }} 
      />
      <Drawer.Screen 
        component={FilesScreen} 
        name="Files" 
        options={{ 
          title: "Files & Documents",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="folder-outline" size={size} /> 
        }} 
      />
      <Drawer.Screen 
        component={ProjectsScreen} 
        name="Projects" 
        options={{ 
          title: "Projects / Targets",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="target" size={size} /> 
        }} 
      />
      <Drawer.Screen 
        component={TasksScreen} 
        name="Tasks" 
        options={{ 
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="clipboard-list" size={size} /> 
        }} 
      />
      <Drawer.Screen 
        component={FormsScreen} 
        name="Forms" 
        options={{ 
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="file-document-edit-outline" size={size} /> 
        }} 
      />
      <Drawer.Screen 
        component={IssuesScreen} 
        name="Issues" 
        options={{ 
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="check-circle-outline" size={size} /> 
        }} 
      />
      <Drawer.Screen 
        component={AttendanceScreen} 
        name="Attendance" 
        options={{ 
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="calendar-check" size={size} /> 
        }} 
      />
      <Drawer.Screen 
        component={DayEndReportScreen} 
        name="DayEndReport" 
        options={{ 
          title: "Day End Report",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="file-document-edit" size={size} /> 
        }} 
      />
      <Drawer.Screen 
        component={ExpenseScreen} 
        name="Expenses" 
        options={{ 
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="file-document-outline" size={size} /> 
        }} 
      />
      <Drawer.Screen 
        component={LeaveRequestScreen} 
        name="LeaveRequest" 
        options={{ 
          title: "Leave Management",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="calendar-clock" size={size} /> 
        }} 
      />
      <Drawer.Screen
        component={MonthlyReportScreen}
        name="MonthlyReport"
        options={{
          title: "Monthly Reports",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="file-chart-outline" size={size} />
        }}
      />
      <Drawer.Screen
        component={SalarySlipScreen}
        name="SalarySlips"
        options={{
          title: "Salary Slips",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="file-document-outline" size={size} />
        }}
      />
      <Drawer.Screen
        component={ProfileScreen}
        name="Profile"
        options={{ 
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="account" size={size} /> 
        }} 
      />
    </Drawer.Navigator>
  );
}

const ManagerDrawerNavigator = createDrawerNavigator<ManagerDrawerParamList>();

function ManagerDrawer() {
  return (
    <ManagerDrawerNavigator.Navigator
      useLegacyImplementation={false}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: "#FFFFFF", elevation: 2, shadowOpacity: 0.1 },
        headerTitleStyle: { color: "#1A202C", fontWeight: "700" },
        headerLeft: () => (
          <IconButton
            icon={appIconSource("menu")}
            size={24}
            iconColor="#1A202C"
            onPress={() => navigation.toggleDrawer()}
            style={{ marginLeft: 8 }}
          />
        ),
        drawerActiveTintColor: "#1A202C",
        drawerInactiveTintColor: "#64748B",
        drawerLabelStyle: { fontWeight: "600", marginLeft: -16 },
        drawerItemStyle: { borderRadius: 8, marginHorizontal: 8, marginVertical: 2 },
      })}
    >
      <ManagerDrawerNavigator.Screen 
        component={ManagerHomeScreen} 
        name="ManagerHome" 
        options={{ 
          title: "Home",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="home" size={size} /> 
        }} 
      />
      <ManagerDrawerNavigator.Screen 
        component={FilesScreen} 
        name="Files" 
        options={{ 
          title: "Files & Documents",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="folder-outline" size={size} /> 
        }} 
      />
      <ManagerDrawerNavigator.Screen 
        component={ProjectsScreen} 
        name="Projects" 
        options={{ 
          title: "My Projects / Targets",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="target" size={size} /> 
        }} 
      />
      <ManagerDrawerNavigator.Screen
        component={ManagerTeamScreen}
        name="ManagerTeam"
        options={{
          title: "Team Overview",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="account-group" size={size} />
        }}
      />
      <ManagerDrawerNavigator.Screen
        component={ManagerAttendanceScreen}
        name="ManagerAttendance"
        options={{
          title: "Team Attendance",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="calendar-check" size={size} />
        }}
      />
      <ManagerDrawerNavigator.Screen
        component={AttendanceScreen}
        name="Attendance"
        options={{
          title: "My Attendance",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="calendar-check" size={size} />
        }}
      />
      <ManagerDrawerNavigator.Screen
        component={DayEndReportScreen}
        name="DayEndReport"
        options={{
          title: "My Day End Report",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="file-document-edit" size={size} />
        }}
      />
      <ManagerDrawerNavigator.Screen 
        component={ManagerTasksScreen} 
        name="ManagerTasks" 
        options={{ 
          title: "Tasks Management",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="clipboard-list" size={size} /> 
        }} 
      />
      <ManagerDrawerNavigator.Screen 
        component={ManagerReportsScreen} 
        name="ManagerReports" 
        options={{ 
          title: "Staff Reports",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="file-document-edit" size={size} /> 
        }} 
      />
      <ManagerDrawerNavigator.Screen 
        component={ManagerFormsScreen} 
        name="ManagerForms" 
        options={{ 
          title: "Forms Submissions",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="file-document-edit-outline" size={size} /> 
        }} 
      />
      <ManagerDrawerNavigator.Screen 
        component={ManagerIssuesScreen} 
        name="ManagerIssues" 
        options={{ 
          title: "Issues Resolution",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="check-circle-outline" size={size} /> 
        }} 
      />
      <ManagerDrawerNavigator.Screen 
        component={TasksScreen} 
        name="Tasks" 
        options={{ 
          title: "My Tasks",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="clipboard-list" size={size} /> 
        }} 
      />
      <ManagerDrawerNavigator.Screen
        component={MonthlyReportScreen}
        name="MonthlyReport"
        options={{
          title: "My Reports",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="file-chart-outline" size={size} />
        }}
      />
      <ManagerDrawerNavigator.Screen
        component={SalarySlipScreen}
        name="SalarySlips"
        options={{
          title: "My Salary Slips",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="file-document-outline" size={size} />
        }}
      />
      <ManagerDrawerNavigator.Screen
        component={ProfileScreen}
        name="Profile"
        options={{ 
          title: "Profile",
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="account" size={size} /> 
        }} 
      />
    </ManagerDrawerNavigator.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerHeader: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#F8FAFC',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  drawerLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A202C',
  },
  drawerUser: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600'
  },
  drawerList: {
    paddingVertical: 10,
  },
  divider: {
    backgroundColor: '#E2E8F0',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginTop: 10,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  logoutText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  }
});
