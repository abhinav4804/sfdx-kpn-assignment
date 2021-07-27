public with sharing class OrderProductController {

    public static final string ACTIVATED = 'Activated'; 
    
    /*
    Method name:- orderProducts
    Parameters:- 
    Description:- 
    */
    @AuraEnabled
    public static List<OrderItem> orderProducts(String orderId){
        List<OrderItem> orderProductsList = new List<OrderItem>();
        try {
            //Get the list of already added Products based on the Order
            orderProductsList = [Select Id, Product2Id, Product2.Name, UnitPrice, Quantity, TotalPrice FROM OrderItem WHERE OrderId =: orderId];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }

        return orderProductsList;
    }

    @AuraEnabled
    public static void activateOrder(String orderId){
        try {
            Order orderRec = new Order();
            orderRec.Id = orderId;
            orderRec.Status = ACTIVATED;

            update orderRec;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}