import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import {
  createDrawerNavigator, 
  DrawerContentScrollView, 
  DrawerItemList 
} from "@react-navigation/drawer";
import { ActivityIndicator, Image, View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Divider, IconButton } from "react-native-paper";

import { appIconSource, AppIcon } from "../components/AppIcon";
import { useAuth } from "../auth/AuthContext";
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

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainDrawerParamList = {
  Home: undefined;
  Tasks: undefined;
  Forms: undefined;
  Issues: undefined;
  Attendance: undefined;
  DayEndReport: undefined;
  Expenses: undefined;
  MonthlyReport: undefined;
  Profile: undefined;
  LeaveRequest: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<MainDrawerParamList>();

export function AppNavigator() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#1A202C" size="large" />
        <Text style={{ marginTop: 12 }}>Loading StaffTrack</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen component={MainDrawer} name="Main" />
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
        component={ProfileScreen} 
        name="Profile" 
        options={{ 
          drawerIcon: ({ color, size }) => <AppIcon color={color} name="account" size={size} /> 
        }} 
      />
    </Drawer.Navigator>
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
